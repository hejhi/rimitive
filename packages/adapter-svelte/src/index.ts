/**
 * @fileoverview Svelte adapter for Lattice
 *
 * Provides two adapter implementations:
 * 1. Standard adapter - Full compatibility with Lattice patterns (~7x overhead)
 * 2. Native Svelte store adapter - Idiomatic Svelte with good performance
 */

import type { ComponentFactory, StoreAdapter } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';
import { writable } from 'svelte/store';
import { createStoreAdapter, type AdapterOptions } from './store-adapter';

/**
 * Creates a Svelte adapter for a Lattice component.
 *
 * This adapter provides full compatibility with Lattice patterns while
 * maintaining good performance (reduced from ~25x to ~7x overhead).
 *
 * @param componentFactory - The Lattice component factory
 * @returns A Lattice store backed by Svelte
 *
 * @example
 * ```typescript
 * const createComponent = (createStore) => {
 *   const createSlice = createStore({ count: 0 });
 *
 *   const counter = createSlice(({ get, set }) => ({
 *     value: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *
 *   return { counter };
 * };
 *
 * const store = createSvelteAdapter(createComponent);
 * store.counter.increment();
 * ```
 */
export function createSvelteAdapter<Component, State>(
  componentFactory: ComponentFactory<Component, State>,
  options?: AdapterOptions
) {
  const adapterFactory = (initialState: State) =>
    createStoreAdapter(initialState, options);
  return createLatticeStore(componentFactory, adapterFactory);
}

/**
 * Creates an idiomatic Svelte store adapter for Lattice.
 *
 * This version uses native Svelte stores internally for better
 * integration with Svelte's reactive system.
 */
export function createSvelteStoreAdapter<Component, State>(
  componentFactory: ComponentFactory<Component, State>,
  options?: AdapterOptions
) {
  const adapterFactory = (initialState: State): StoreAdapter<State> => {
    // Use a real Svelte store internally
    const store = writable(initialState);
    let currentState = initialState;

    // Error handling
    const handleError =
      options?.onError ??
      ((error) => {
        console.error('Error in store listener:', error);
      });

    // Lattice listeners (separate from Svelte's subscription)
    const listeners = new Set<() => void>();

    // Subscribe to Svelte store and notify Lattice listeners
    store.subscribe((value) => {
      currentState = value;
      // Notify all Lattice listeners when Svelte store updates
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          handleError(error);
        }
      });
    });

    return {
      getState: () => currentState,

      setState: (updates) => {
        if (!updates || Object.keys(updates).length === 0) return;

        // Use Svelte's update method
        // This will trigger the subscription above, which notifies listeners
        store.update((state) => ({ ...state, ...updates }));
      },

      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  return createLatticeStore(componentFactory, adapterFactory);
}

// Export individual adapters for advanced use cases
export { createStoreAdapter } from './store-adapter';

// Re-export types
export type { StoreAdapter } from '@lattice/core';
export type { AdapterOptions } from './store-adapter';
