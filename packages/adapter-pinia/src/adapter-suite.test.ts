/**
 * @fileoverview Adapter test suite for Pinia adapter
 * 
 * Ensures the Pinia adapter conforms to the Lattice adapter contract
 */

import { describe, it, expect, vi } from 'vitest';
import { piniaAdapter } from './index';
import { createPinia, defineStore } from 'pinia';

describe('Pinia Adapter Contract', () => {
  it('should correctly wrap a Pinia store', () => {
    // Create a Pinia instance
    const pinia = createPinia();
    
    // Define and create a Pinia store
    const useStore = defineStore('test', {
      state: () => ({ count: 0 }),
    });
    
    const store = useStore(pinia);
    
    // Wrap it with the adapter
    const createSlice = piniaAdapter(store);

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

  it('should work with Pinia stores that have actions and getters', () => {
    const pinia = createPinia();
    
    const useStore = defineStore('advanced', {
      state: () => ({ 
        value: 0,
        multiplier: 2 
      }),
      getters: {
        doubled: (state) => state.value * state.multiplier,
      },
      actions: {
        setValue(newValue: number) {
          this.value = newValue;
        }
      }
    });
    
    const store = useStore(pinia);
    const createSlice = piniaAdapter(store);

    const component = (() => {
      const slice = createSlice(({ get, set }) => ({
        getValue: () => get().value,
        setValue: (value: number) => set({ value }),
        getDoubled: () => get().value * get().multiplier,
      }));
      return slice;
    })();

    expect(component.selector.getValue()).toBe(0);
    expect(component.selector.getDoubled()).toBe(0);

    // Test through Lattice
    component.selector.setValue(21);
    expect(component.selector.getValue()).toBe(21);
    expect(component.selector.getDoubled()).toBe(42);

    // Test through native Pinia action
    store.setValue(10);
    expect(component.selector.getValue()).toBe(10);
    expect(component.selector.getDoubled()).toBe(20);
  });

  it('should handle subscriptions correctly', () => {
    const pinia = createPinia();
    const useStore = defineStore('sub-test', {
      state: () => ({ count: 0 }),
    });
    
    const store = useStore(pinia);
    const createSlice = piniaAdapter(store);

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