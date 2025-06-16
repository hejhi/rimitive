import { describe, expect, it } from 'vitest';
import { createLatticeStore } from './runtime';
import type { StoreAdapter, RuntimeSliceFactory } from './index';

describe('slice composition patterns', () => {
  // Helper to create a test adapter
  const createTestAdapter = <State>(initialState: State): StoreAdapter<State> => {
    let state = { ...initialState };
    const listeners = new Set<() => void>();
    
    return {
      getState: () => state,
      setState: (updates) => {
        state = { ...state, ...updates };
        listeners.forEach(listener => listener());
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
    
    const createComponent = (createSlice: RuntimeSliceFactory<State>) => {

      // Product queries slice
      const products = createSlice(({ get }) => ({
        all: () => get().products,
        byId: (id: string) => get().products.find((p) => p.id === id),
        byCategory: (category: string) =>
          get().products.filter((p) => p.category === category),
      }));

      // Pricing calculations slice that spreads products methods
      const pricing = createSlice((tools) => ({
        taxRate: () => tools.get().taxRate,
        discount: () => tools.get().discount,
        calculatePrice: (basePrice: number) => {
          const discounted = basePrice * (1 - tools.get().discount);
          return discounted * (1 + tools.get().taxRate);
        },
        // Spread all products methods into pricing slice
        ...products.compose(tools).selector,
      }));

      return { products, pricing };
    };

    const adapter = createTestAdapter({ 
        products: [
          { id: '1', category: 'electronics', price: 100 },
          { id: '2', category: 'clothing', price: 50 },
          { id: '3', category: 'electronics', price: 200 }
        ],
        taxRate: 0.1,
        discount: 0.2
      });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Test that pricing has all the products methods
    expect(typeof component.pricing.selector.all).toBe('function');
    expect(typeof component.pricing.selector.byId).toBe('function');
    expect(typeof component.pricing.selector.byCategory).toBe('function');
    
    // Test that the methods work correctly
    expect(component.pricing.selector.all()).toHaveLength(3);
    expect(component.pricing.selector.byId('2')).toEqual({
      id: '2', category: 'clothing', price: 50
    });
    expect(component.pricing.selector.byCategory('electronics')).toHaveLength(2);
    
    // Test pricing-specific methods
    expect(component.pricing.selector.taxRate()).toBe(0.1);
    expect(component.pricing.selector.discount()).toBe(0.2);
    expect(component.pricing.selector.calculatePrice(100)).toBe(88); // 100 * 0.8 * 1.1
  });

  it('should allow slice-level subscriptions', () => {
    type State = { count: number; name: string };
    
    const createComponent = (createSlice: RuntimeSliceFactory<State>) => {

      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
      }));

      const user = createSlice(({ get, set }) => ({
        name: () => get().name,
        setName: (name: string) => set({ name }),
      }));

      return { counter, user };
    };

    const adapter = createTestAdapter({ count: 0, name: 'test' });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Subscribe to counter slice
    let counterUpdates = 0;
    const unsubscribeCounter = component.counter.subscribe(() => {
      counterUpdates++;
    });

    // Subscribe to user slice
    let userUpdates = 0;
    const unsubscribeUser = component.user.subscribe(() => {
      userUpdates++;
    });

    // Update counter - both subscriptions should fire (shared state)
    component.counter.selector.increment();
    expect(counterUpdates).toBe(1);
    expect(userUpdates).toBe(1);

    // Update user - both subscriptions should fire (shared state)
    component.user.selector.setName('Alice');
    expect(counterUpdates).toBe(2);
    expect(userUpdates).toBe(2);

    // Unsubscribe counter
    unsubscribeCounter();

    // Update again - only user subscription should fire
    component.counter.selector.increment();
    expect(counterUpdates).toBe(2); // No change
    expect(userUpdates).toBe(3);

    unsubscribeUser();
  });

  it('should correctly rebind slices when composing', () => {
    type State = { value: number };
    
    const createComponent = (createSlice: RuntimeSliceFactory<State>) => {

      const base = createSlice(({ get, set }) => ({
        getValue: () => get().value,
        setValue: (value: number) => set({ value }),
      }));

      // Create two different composed slices that include base
      const sliceA = createSlice((tools) => ({
        doubleValue: () => tools.get().value * 2,
        // Compose base - this should be rebound to use sliceA's tools
        ...base.compose(tools).selector,
      }));

      const sliceB = createSlice((tools) => ({
        tripleValue: () => tools.get().value * 3,
        // Compose base - this should be rebound to use sliceB's tools
        ...base.compose(tools).selector,
      }));

      return { base, sliceA, sliceB };
    };

    const adapter = createTestAdapter({ value: 0 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // All slices should see the same value
    expect(component.base.selector.getValue()).toBe(0);
    expect(component.sliceA.selector.getValue()).toBe(0);
    expect(component.sliceB.selector.getValue()).toBe(0);

    // Update through sliceA
    component.sliceA.selector.setValue(10);

    // All slices should see the updated value
    expect(component.base.selector.getValue()).toBe(10);
    expect(component.sliceA.selector.getValue()).toBe(10);
    expect(component.sliceB.selector.getValue()).toBe(10);
    expect(component.sliceA.selector.doubleValue()).toBe(20);
    expect(component.sliceB.selector.tripleValue()).toBe(30);
  });
});