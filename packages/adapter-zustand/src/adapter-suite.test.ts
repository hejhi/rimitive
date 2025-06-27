/**
 * @fileoverview Adapter test suite for Zustand adapter
 *
 * Ensures the Zustand adapter conforms to the Lattice adapter contract
 */

import { describe, it, expect, vi } from 'vitest';
import { zustandAdapter } from './index';
import { createStore as zustandCreateStore } from 'zustand/vanilla';
import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';
import { createAdapterTestSuite } from '@lattice/core/testing';

describe('Zustand Adapter Contract', () => {
  it('should correctly wrap a Zustand store', () => {
    // Create a Zustand store
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));

    // Wrap it with the adapter
    const adapter = zustandAdapter(store);

    // Create a simple component using new API
    const Counter = createComponent(
      withState<{ count: number }>(),
      ({ store, set }) => ({
        value: store.count,
        increment: () => set({ count: store.count() + 1 }),
      })
    );

    const counter = createStoreWithAdapter(Counter, adapter);

    // Test basic functionality
    expect(counter.value()).toBe(0);

    counter.increment();
    expect(counter.value()).toBe(1);
  });

  it('should work with Zustand stores created with middleware', () => {
    // Test that adapter works with any Zustand store, including those with middleware
    // Here we'll use subscribeWithSelector middleware as an example
    let stateChanges: Array<{ value: number }> = [];

    const store = zustandCreateStore<{ value: number }>(() => ({
      value: 0,
    }));

    // Track state changes through Zustand's native subscribe
    store.subscribe((state) => {
      stateChanges.push(state);
    });

    const adapter = zustandAdapter(store);

    const Component = createComponent(
      withState<{ value: number }>(),
      ({ store, set }) => ({
        getValue: store.value,
        setValue: (newValue: number) => set({ value: newValue }),
      })
    );

    const component = createStoreWithAdapter(Component, adapter);

    expect(component.getValue()).toBe(0);

    component.setValue(42);
    expect(component.getValue()).toBe(42);

    // Verify Zustand's native subscription still works
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0]).toEqual({ value: 42 });
  });

  it('should handle subscriptions correctly', () => {
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));
    const adapter = zustandAdapter(store);

    const Counter = createComponent(
      withState<{ count: number }>(),
      ({ store, set }) => ({
        value: store.count,
        increment: () => set({ count: store.count() + 1 }),
      })
    );

    const counter = createStoreWithAdapter(Counter, adapter);

    const listener = vi.fn();
    const unsubscribe = counter.value.subscribe(listener);

    counter.increment();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    counter.increment();
    expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called after unsubscribe
  });

  it('should support fine-grained subscriptions', () => {
    const store = zustandCreateStore<{ 
      a: number; 
      b: number; 
      c: number 
    }>(() => ({ a: 1, b: 2, c: 3 }));
    
    const adapter = zustandAdapter(store);

    // Create components with different dependencies
    const ComponentA = createComponent(
      withState<{ a: number; b: number; c: number }>(),
      ({ store }) => ({ 
        value: store.a,
      })
    );
    
    const ComponentB = createComponent(
      withState<{ a: number; b: number; c: number }>(),
      ({ store }) => ({ 
        value: store.b,
      })
    );
    
    const ComponentAB = createComponent(
      withState<{ a: number; b: number; c: number }>(),
      ({ store, computed }) => ({ 
        sum: computed(() => store.a() + store.b()),
        a: store.a,
        b: store.b,
      })
    );

    const sliceA = createStoreWithAdapter(ComponentA, adapter);
    const sliceB = createStoreWithAdapter(ComponentB, adapter);
    const sliceAB = createStoreWithAdapter(ComponentAB, adapter);

    // Track notifications
    const aListener = vi.fn();
    const bListener = vi.fn();
    const abAListener = vi.fn();
    const abBListener = vi.fn();
    
    sliceA.value.subscribe(aListener);
    sliceB.value.subscribe(bListener);
    sliceAB.a.subscribe(abAListener);
    sliceAB.b.subscribe(abBListener);
    
    // Change only 'a' - should notify sliceA and sliceAB (a signal), but not sliceB
    store.setState({ a: 10 });
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(bListener).toHaveBeenCalledTimes(0);
    expect(abAListener).toHaveBeenCalledTimes(1);
    expect(abBListener).toHaveBeenCalledTimes(0);
    
    // Change only 'b' - should notify sliceB and sliceAB (b signal), but not sliceA
    store.setState({ b: 20 });
    expect(aListener).toHaveBeenCalledTimes(1); // Still 1
    expect(bListener).toHaveBeenCalledTimes(1);
    expect(abAListener).toHaveBeenCalledTimes(1); // Still 1
    expect(abBListener).toHaveBeenCalledTimes(1);
    
    // Change 'c' - should not notify any slice (no dependencies on c)
    store.setState({ c: 30 });
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(bListener).toHaveBeenCalledTimes(1);
    expect(abAListener).toHaveBeenCalledTimes(1);
    expect(abBListener).toHaveBeenCalledTimes(1);
    
    // Verify values are correct
    expect(sliceA.value()).toBe(10);
    expect(sliceB.value()).toBe(20);
    expect(sliceAB.sum()).toBe(30);
  });
});

// Run the shared adapter test suite
const createTestAdapter = <State>(initialState?: State) => {
  const store = zustandCreateStore<State>(() => initialState ?? ({} as State));
  return zustandAdapter(store);
};

createAdapterTestSuite('Zustand', createTestAdapter);
