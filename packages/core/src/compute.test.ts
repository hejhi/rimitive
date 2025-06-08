import { describe, it, expect } from 'vitest';
import { compute } from './compute';
import { createModel, createSlice, type SliceFactory, type ModelFactory } from './index';

// Simple test adapter for testing
function createTestAdapter<T>(modelFactory: ModelFactory<T>) {
  let state: T;
  
  // Initialize model
  const model = modelFactory({
    get: () => state,
    set: (updates) => { state = { ...state, ...updates }; }
  });
  
  state = model;
  
  return {
    getState: () => state,
    executeSlice: <S>(sliceFactory: SliceFactory<T, S>): S => {
      return sliceFactory(() => state);
    },
    clearCache: () => {
      // No-op for simple test adapter
    }
  };
}

describe('compute', () => {
  it('should create a parameterized computed view', () => {
    // Define model
    const model = createModel<{ count: number; total: number }>(({ set, get }) => ({
      count: 10,
      total: 100,
      increment: () => set({ count: get().count + 1 })
    }));

    // Define base slice
    const counterSlice = createSlice(model, (m) => ({
      count: () => m().count,
      total: () => m().total
    }));

    // Create computed view with parameters
    const multipliedCounter = compute(
      { counter: counterSlice },
      ({ counter }) => (multiplier: number) => ({
        value: counter.count() * multiplier,
        label: `×${multiplier}: ${counter.count()}`,
        percentage: (counter.count() * multiplier * 100) / counter.total()
      })
    );

    // Create test adapter
    const store = createTestAdapter(model);
    
    // Execute the computed slice to get the parameterized function
    const multipliedView = store.executeSlice(multipliedCounter);
    
    // Apply parameters
    const doubled = multipliedView(2);
    expect(doubled.value).toBe(20);
    expect(doubled.label).toBe('×2: 10');
    expect(doubled.percentage).toBe(20);
    
    const tripled = multipliedView(3);
    expect(tripled.value).toBe(30);
    expect(tripled.label).toBe('×3: 10');
    expect(tripled.percentage).toBe(30);
  });

  it('should memoize parameterized views', () => {
    const model = createModel<{ value: number }>(() => ({ value: 42 }));
    const valueSlice = createSlice(model, (m) => ({
      get: () => m().value
    }));

    let computationCount = 0;
    const computedView = compute(
      { value: valueSlice },
      ({ value }) => (multiplier: number) => {
        computationCount++;
        return {
          result: value.get() * multiplier
        };
      }
    );

    const store = createTestAdapter(model);
    const view = store.executeSlice(computedView);
    
    // Reset count after initial execution
    computationCount = 0;
    
    // First call with parameter 2
    const result1 = view(2);
    expect(result1.result).toBe(84);
    expect(computationCount).toBe(1);
    
    // Second call with same parameter - should be memoized
    const result2 = view(2);
    expect(result2.result).toBe(84);
    expect(computationCount).toBe(1); // No additional computation
    
    // Call with different parameter
    const result3 = view(3);
    expect(result3.result).toBe(126);
    expect(computationCount).toBe(2);
  });

  it('should handle multiple dependencies', () => {
    const model = createModel<{
      user: { name: string; role: string };
      settings: { theme: string; language: string };
    }>(() => ({
      user: { name: 'Alice', role: 'admin' },
      settings: { theme: 'dark', language: 'en' }
    }));

    const userSlice = createSlice(model, (m) => ({
      name: m().user.name,
      role: m().user.role,
      isAdmin: m().user.role === 'admin'
    }));

    const settingsSlice = createSlice(model, (m) => ({
      theme: m().settings.theme,
      language: m().settings.language
    }));

    const profileView = compute(
      { user: userSlice, settings: settingsSlice },
      ({ user, settings }) => (format: 'short' | 'long') => {
        if (format === 'short') {
          return {
            display: `${user.name} (${settings.theme})`
          };
        }
        return {
          display: `${user.name} - ${user.role} - ${settings.theme} theme - ${settings.language}`
        };
      }
    );

    const store = createTestAdapter(model);
    const view = store.executeSlice(profileView);
    
    expect(view('short').display).toBe('Alice (dark)');
    expect(view('long').display).toBe('Alice - admin - dark theme - en');
  });

  it('should handle complex nested computations', () => {
    const model = createModel<{
      items: Array<{ id: number; name: string; price: number }>;
      discount: number;
    }>(() => ({
      items: [
        { id: 1, name: 'Item 1', price: 10 },
        { id: 2, name: 'Item 2', price: 20 },
        { id: 3, name: 'Item 3', price: 30 }
      ],
      discount: 0.1
    }));

    const itemsSlice = createSlice(model, (m) => ({
      all: m().items,
      byId: (id: number) => m().items.find(item => item.id === id),
      total: m().items.reduce((sum, item) => sum + item.price, 0)
    }));

    const discountSlice = createSlice(model, (m) => ({
      rate: m().discount,
      percentage: m().discount * 100
    }));

    const priceView = compute(
      { items: itemsSlice, discount: discountSlice },
      ({ items, discount }) => (itemId: number, includeTax = false) => {
        const item = items.byId(itemId);
        if (!item) {
          return { 
            name: 'Not found',
            originalPrice: 0,
            discountedPrice: 0,
            finalPrice: 0
          };
        }
        
        const discountedPrice = item.price * (1 - discount.rate);
        const finalPrice = includeTax ? discountedPrice * 1.08 : discountedPrice;
        
        return {
          name: item.name,
          originalPrice: item.price,
          discountedPrice,
          finalPrice,
          savings: item.price - discountedPrice
        };
      }
    );

    const store = createTestAdapter(model);
    const view = store.executeSlice(priceView);
    
    const item2 = view(2, false);
    expect(item2.name).toBe('Item 2');
    expect(item2.originalPrice).toBe(20);
    expect(item2.discountedPrice).toBe(18);
    expect(item2.finalPrice).toBe(18);
    expect(item2.savings).toBe(2);
    
    const item2WithTax = view(2, true);
    expect(item2WithTax.finalPrice).toBeCloseTo(19.44, 2);
  });

  it('should work with no dependencies', () => {
    const model = createModel<{ multiplier: number }>(() => ({ 
      multiplier: 2 
    }));

    // Computed view with no slice dependencies
    const staticComputed = compute(
      {},
      () => (input: number) => ({
        doubled: input * 2,
        squared: input * input
      })
    );

    const store = createTestAdapter(model);
    const view = store.executeSlice(staticComputed);
    
    expect(view(5).doubled).toBe(10);
    expect(view(5).squared).toBe(25);
  });

  it('should handle functions as return values', () => {
    const model = createModel<{ base: number }>(() => ({ base: 10 }));
    const baseSlice = createSlice(model, (m) => ({
      value: m().base
    }));

    const functionView = compute(
      { base: baseSlice },
      ({ base }) => (factor: number) => ({
        calculate: (input: number) => input * factor + base.value,
        describe: () => `Multiply by ${factor} and add ${base.value}`
      })
    );

    const store = createTestAdapter(model);
    const view = store.executeSlice(functionView);
    const withFactor3 = view(3);
    
    expect(withFactor3.calculate(5)).toBe(25); // 5 * 3 + 10
    expect(withFactor3.describe()).toBe('Multiply by 3 and add 10');
  });

  it('should handle reactive updates when model changes', () => {
    const model = createModel<{ count: number; increment: () => void }>(
      ({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 })
      })
    );

    const countSlice = createSlice(model, (m) => ({
      value: () => m().count
    }));

    const multipliedView = compute(
      { count: countSlice },
      ({ count }) => (multiplier: number) => ({
        result: count.value() * multiplier
      })
    );

    const store = createTestAdapter(model);
    
    // Initial state
    const view1 = store.executeSlice(multipliedView);
    expect(view1(2).result).toBe(0);
    
    // Update state
    store.getState().increment();
    
    // Clear cache to simulate re-execution
    store.clearCache();
    
    // Check updated value
    const view2 = store.executeSlice(multipliedView);
    expect(view2(2).result).toBe(2);
  });
});

// In-source tests
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  const { SLICE_FACTORY_MARKER } = await import('./index');

  test('compute returns a valid SliceFactory', () => {
    const model = createModel<{ value: number }>(() => ({ value: 42 }));
    const slice = createSlice(model, (m) => ({ get: () => m().value }));
    
    const computed = compute(
      { slice },
      ({ slice }) => (n: number) => ({ result: slice.get() * n })
    );
    
    // Should be a function (SliceFactory)
    expect(typeof computed).toBe('function');
    
    // Should have the slice factory marker
    expect(SLICE_FACTORY_MARKER in computed).toBe(true);
  });
}