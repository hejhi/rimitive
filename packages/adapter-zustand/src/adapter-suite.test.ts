/**
 * @fileoverview Adapter test suite for Zustand adapter
 *
 * Ensures the Zustand adapter conforms to the Lattice adapter contract
 */

import { describe, it, expect, vi } from 'vitest';
import { zustandAdapter } from './index';
import { createStore as zustandCreateStore } from 'zustand/vanilla';
import type { ReactiveSliceFactory } from '@lattice/core';

describe('Zustand Adapter Contract', () => {
  it('should correctly wrap a Zustand store', () => {
    // Create a Zustand store
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));

    // Wrap it with the adapter
    const createSlice: ReactiveSliceFactory<{ count: number }> = zustandAdapter(store);

    // Create a simple component using two-phase pattern
    const component = (() => {
      const slice = createSlice(
        (selectors) => ({ count: selectors.count }),
        ({ count }, set) => ({
          value: () => count(),
          increment: () => set(
            ({ count }) => ({ count: count() + 1 })
          ),
        })
      );
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
      const slice = createSlice(
        (selectors) => ({ value: selectors.value }),
        ({ value }, set) => ({
          getValue: () => value(),
          setValue: (newValue: number) => set(
            () => ({ value: newValue })
          ),
        })
      );
      return slice;
    })();

    expect(component().getValue()).toBe(0);

    component().setValue(42);
    expect(component().getValue()).toBe(42);

    // Verify Zustand's native subscription still works
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0]).toEqual({ value: 42 });
  });

  it('should handle subscriptions correctly', async () => {
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));
    const createSlice = zustandAdapter(store);

    const component = (() => {
      const slice = createSlice(
        (selectors) => ({ count: selectors.count }),
        ({ count }, set) => ({
          value: () => count(),
          increment: () => set(
            ({ count }) => ({ count: count() + 1 })
          ),
        })
      );
      return slice;
    })();

    // Import getSliceMetadata to access subscriptions
    const { getSliceMetadata } = await import('@lattice/core');
    const metadata = getSliceMetadata(component);
    
    const listener = vi.fn();
    const unsubscribe = metadata!.subscribe(listener);

    component().increment();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    component().increment();
    expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called after unsubscribe
  });

  it('should support fine-grained subscriptions', async () => {
    const store = zustandCreateStore<{ 
      a: number; 
      b: number; 
      c: number 
    }>(() => ({ a: 1, b: 2, c: 3 }));
    
    const createSlice = zustandAdapter(store);

    // Create slices with different dependencies
    const sliceA = createSlice(
      (selectors) => ({ a: selectors.a }),
      ({ a }) => ({ value: () => a() })
    );
    
    const sliceB = createSlice(
      (selectors) => ({ b: selectors.b }),
      ({ b }) => ({ value: () => b() })
    );
    
    const sliceAB = createSlice(
      (selectors) => ({ a: selectors.a, b: selectors.b }),
      ({ a, b }) => ({ sum: () => a() + b() })
    );

    // Get metadata for subscriptions
    const { getSliceMetadata } = await import('@lattice/core');
    
    // Track notifications
    const aListener = vi.fn();
    const bListener = vi.fn();
    const abListener = vi.fn();
    
    getSliceMetadata(sliceA)!.subscribe(aListener);
    getSliceMetadata(sliceB)!.subscribe(bListener);
    getSliceMetadata(sliceAB)!.subscribe(abListener);
    
    // Change only 'a' - should notify sliceA and sliceAB, but not sliceB
    store.setState({ a: 10 });
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(bListener).toHaveBeenCalledTimes(0);
    expect(abListener).toHaveBeenCalledTimes(1);
    
    // Change only 'b' - should notify sliceB and sliceAB, but not sliceA
    store.setState({ b: 20 });
    expect(aListener).toHaveBeenCalledTimes(1); // Still 1
    expect(bListener).toHaveBeenCalledTimes(1);
    expect(abListener).toHaveBeenCalledTimes(2);
    
    // Change 'c' - should not notify any slice (no dependencies on c)
    store.setState({ c: 30 });
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(bListener).toHaveBeenCalledTimes(1);
    expect(abListener).toHaveBeenCalledTimes(2);
    
    // Verify values are correct
    expect(sliceA().value()).toBe(10);
    expect(sliceB().value()).toBe(20);
    expect(sliceAB().sum()).toBe(30);
  });
});
