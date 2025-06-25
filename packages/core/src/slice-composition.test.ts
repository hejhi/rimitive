import { describe, expect, it } from 'vitest';
import { createLatticeStore, computed } from './runtime';
import type { StoreAdapter, ReactiveSliceFactory } from './index';

describe('slice composition patterns', () => {
  // Helper to create a test adapter
  const createTestAdapter = <State>(
    initialState: State
  ): StoreAdapter<State> => {
    let state = { ...initialState };
    const listeners = new Set<() => void>();

    return {
      getState: () => state,
      setState: (updates) => {
        state = { ...state, ...updates };
        listeners.forEach((listener) => listener());
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  it('should allow spreading composed slice methods', () => {
    type State = {
      products: Array<{ id: string; category: string; price: number }>;
      taxRate: number;
      discount: number;
    };

    const createComponent = (createSlice: ReactiveSliceFactory<State>) => {
      // Product queries slice
      const products = createSlice(({ products }, _set) => ({
        all: () => products(),
        byId: (id: string) => products().find((p: { id: string; category: string; price: number }) => p.id === id),
        byCategory: (category: string) => products().filter((p: { id: string; category: string; price: number }) => p.category === category),
      }));

      // Pricing calculations slice that spreads products methods
      const pricing = createSlice(({ taxRate, discount }, _set) => {
        // Extract specific methods from products for composition
        const { all, byId, byCategory } = products(({ all, byId, byCategory }) => ({ all, byId, byCategory }));
        
        return {
          taxRate,
          discount,
          calculatePrice: (basePrice: number) => {
            const discounted = basePrice * (1 - discount());
            return discounted * (1 + taxRate());
          },
          // Re-expose the composed methods
          all,
          byId,
          byCategory
        };
      });

      return { products, pricing };
    };

    const adapter = createTestAdapter({
      products: [
        { id: '1', category: 'electronics', price: 100 },
        { id: '2', category: 'clothing', price: 50 },
        { id: '3', category: 'electronics', price: 200 },
      ],
      taxRate: 0.1,
      discount: 0.2,
    });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Test that pricing has all the products methods
    expect(typeof component.pricing().all).toBe('function');
    expect(typeof component.pricing().byId).toBe('function');
    expect(typeof component.pricing().byCategory).toBe('function');

    // Test that the methods work correctly
    expect(component.pricing().all()).toHaveLength(3);
    expect(component.pricing().byId('2')).toEqual({
      id: '2',
      category: 'clothing',
      price: 50,
    });
    expect(component.pricing().byCategory('electronics')).toHaveLength(
      2
    );

    // Test pricing-specific methods
    expect(component.pricing().taxRate()).toBe(0.1);
    expect(component.pricing().discount()).toBe(0.2);
    expect(component.pricing().calculatePrice(100)).toBe(88); // 100 * 0.8 * 1.1
  });

  it('should allow fine-grained signal subscriptions', async () => {
    type State = { count: number; name: string };

    const createComponent = (createSlice: ReactiveSliceFactory<State>) => {
      const counter = createSlice(({ count }, set) => ({
        count,
        increment: () => set({ count: count() + 1 }),
      }));

      const user = createSlice(({ name }, set) => ({
        name,
        setName: (newName: string) => set({ name: newName }),
      }));

      return { counter, user };
    };

    const adapter = createTestAdapter({ count: 0, name: 'test' });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Subscribe directly to signals for fine-grained reactivity
    let counterUpdates = 0;
    const unsubscribeCounter = component.counter().count.subscribe(() => {
      counterUpdates++;
    });

    let userUpdates = 0;
    const unsubscribeUser = component.user().name.subscribe(() => {
      userUpdates++;
    });

    // Update counter - only counter subscription should fire (fine-grained)
    component.counter().increment();
    expect(counterUpdates).toBe(1);
    expect(userUpdates).toBe(0);

    // Update user - only user subscription should fire (fine-grained)
    component.user().setName('Alice');
    expect(counterUpdates).toBe(1);
    expect(userUpdates).toBe(1);

    // Unsubscribe counter
    unsubscribeCounter();

    // Update counter again - counter subscription should not fire
    component.counter().increment();
    expect(counterUpdates).toBe(1); // No change
    expect(userUpdates).toBe(1); // No change

    unsubscribeUser();
  });

  it('should correctly rebind slices when composing', () => {
    type State = { value: number };

    const createComponent = (createSlice: ReactiveSliceFactory<State>) => {
      const base = createSlice(({ value }, set) => ({
        getValue: value,
        setValue: (newValue: number) => set({ value: newValue }),
      }));

      // Create two different composed slices that include base
      const sliceA = createSlice(({ value }, _set) => {
        // Compose base
        const { getValue, setValue } = base(({ getValue, setValue }) => ({ getValue, setValue }));
        
        return {
          doubleValue: computed(() => value() * 2),
          // Re-expose composed methods
          getValue,
          setValue
        };
      });

      const sliceB = createSlice(({ value }, _set) => {
        // Compose base
        const { getValue, setValue } = base(({ getValue, setValue }) => ({ getValue, setValue }));
        
        return {
          tripleValue: computed(() => value() * 3),
          // Re-expose composed methods
          getValue,
          setValue
        };
      });

      return { base, sliceA, sliceB };
    };

    const adapter = createTestAdapter({ value: 0 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // All slices should see the same value
    expect(component.base().getValue()).toBe(0);
    expect(component.sliceA().getValue()).toBe(0);
    expect(component.sliceB().getValue()).toBe(0);

    // Update through sliceA
    component.sliceA().setValue(10);

    // All slices should see the updated value
    expect(component.base().getValue()).toBe(10);
    expect(component.sliceA().getValue()).toBe(10);
    expect(component.sliceB().getValue()).toBe(10);
    expect(component.sliceA().doubleValue()).toBe(20);
    expect(component.sliceB().tripleValue()).toBe(30);
  });
});
