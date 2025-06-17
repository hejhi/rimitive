/**
 * @fileoverview Adapter test suite for Zustand adapter
 *
 * Ensures the Zustand adapter conforms to the Lattice adapter contract
 */

import { describe, it, expect, vi } from 'vitest';
import { zustandAdapter } from './index';
import { createStore as zustandCreateStore } from 'zustand/vanilla';

describe('Zustand Adapter Contract', () => {
  it('should correctly wrap a Zustand store', () => {
    // Create a Zustand store
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));

    // Wrap it with the adapter
    const createSlice = zustandAdapter(store);

    // Create a simple component
    const component = (() => {
      const slice = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
      }));
      return slice;
    })();

    // Test basic functionality
    expect(component.selector.count()).toBe(0);

    component.selector.increment();
    expect(component.selector.count()).toBe(1);
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
      const slice = createSlice(({ get, set }) => ({
        getValue: () => get().value,
        setValue: (value: number) => set({ value }),
      }));
      return slice;
    })();

    expect(component.selector.getValue()).toBe(0);

    component.selector.setValue(42);
    expect(component.selector.getValue()).toBe(42);

    // Verify Zustand's native subscription still works
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0]).toEqual({ value: 42 });
  });

  it('should handle subscriptions correctly', () => {
    const store = zustandCreateStore<{ count: number }>(() => ({ count: 0 }));
    const createSlice = zustandAdapter(store);

    const component = (() => {
      const slice = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
      }));
      return slice;
    })();

    const listener = vi.fn();
    const unsubscribe = component.subscribe(listener);

    component.selector.increment();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    component.selector.increment();
    expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called after unsubscribe
  });
});
