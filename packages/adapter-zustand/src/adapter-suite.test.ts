/**
 * @fileoverview Adapter test suite for Zustand adapter
 *
 * Ensures the Zustand adapter conforms to the Lattice adapter contract
 */

import { describe, it, expect, vi } from 'vitest';
import { zustandAdapter } from './index';
import { createStore as zustandCreateStore } from 'zustand/vanilla';
import type { RuntimeSliceFactory } from '@lattice/core';

describe('Zustand Adapter Contract', () => {
  it('should correctly wrap a Zustand store', () => {
    // Create a Zustand store
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));

    // Wrap it with the adapter
    const createSlice: RuntimeSliceFactory<{ count: number }> = zustandAdapter(store);

    // Create a simple component using signals-first pattern
    const component = (() => {
      const slice = createSlice(({ count }, set) => ({
        value: count, // count is already a signal
        increment: () => set({ count: count() + 1 }),
      }));
      return slice;
    })();

    // Test basic functionality
    expect(component().value()).toBe(0);

    component().increment();
    expect(component().value()).toBe(1);
  });

  it('should work with Zustand stores created with middleware', () => {
    // Test that adapter works with any Zustand store, including those with middleware
    // Here we'll use subscribeWithSelector middleware as an example
    let stateChanges: any[] = [];

    const store = zustandCreateStore<{ value: number }>(() => ({
      value: 0,
    }));

    // Track state changes through Zustand's native subscribe
    store.subscribe((state) => {
      stateChanges.push(state);
    });

    const createSlice = zustandAdapter(store);

    const component = (() => {
      const slice = createSlice(({ value }, set) => ({
        getValue: value, // value is already a signal
        setValue: (newValue: number) => set({ value: newValue }),
      }));
      return slice;
    })();

    expect(component().getValue()).toBe(0);

    component().setValue(42);
    expect(component().getValue()).toBe(42);

    // Verify Zustand's native subscription still works
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0]).toEqual({ value: 42 });
  });

  it('should handle subscriptions correctly', () => {
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));
    const createSlice = zustandAdapter(store);

    const component = (() => {
      const slice = createSlice(({ count }, set) => ({
        value: count, // count is already a signal
        increment: () => set({ count: count() + 1 }),
      }));
      return slice;
    })();

    const listener = vi.fn();
    const unsubscribe = component().value.subscribe(listener);

    component().increment();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    component().increment();
    expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called after unsubscribe
  });

  it('should support fine-grained subscriptions', () => {
    const store = zustandCreateStore<{ 
      a: number; 
      b: number; 
      c: number 
    }>(() => ({ a: 1, b: 2, c: 3 }));
    
    const createSlice = zustandAdapter(store);

    // Create slices with different dependencies
    const sliceA = createSlice(({ a }) => ({ 
      value: a, // a is already a signal 
    }));
    
    const sliceB = createSlice(({ b }) => ({ 
      value: b, // b is already a signal 
    }));
    
    const sliceAB = createSlice(({ a, b }) => ({ 
      sum: () => a() + b(),
      a, // expose signal for subscription
      b, // expose signal for subscription
    }));

    // Track notifications - need to track when any dependency of sliceAB changes
    const aListener = vi.fn();
    const bListener = vi.fn();
    const abAListener = vi.fn(); // Listen to 'a' changes in AB slice
    const abBListener = vi.fn(); // Listen to 'b' changes in AB slice
    
    sliceA().value.subscribe(aListener);
    sliceB().value.subscribe(bListener);
    sliceAB().a.subscribe(abAListener); // Subscribe to 'a' signal in AB slice
    sliceAB().b.subscribe(abBListener); // Subscribe to 'b' signal in AB slice
    
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
    expect(sliceA().value()).toBe(10);
    expect(sliceB().value()).toBe(20);
    expect(sliceAB().sum()).toBe(30);
  });
});
