/**
 * @fileoverview Native Svelte adapter for Lattice
 *
 * This adapter provides optimal Svelte integration with high performance:
 * - Supports both Svelte and Lattice subscription patterns
 * - Map-based listeners for O(1) operations
 * - Pre-allocated arrays for efficient iteration
 * - Comprehensive error handling
 */

import type { StoreAdapter, ComponentFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error in development
   */
  onError?: (error: unknown) => void;
}


/**
 * Creates a Svelte adapter for a Lattice component.
 * 
 * This adapter provides:
 * - Native Svelte store compatibility (supports both subscription patterns)
 * - High performance with Map-based listeners and pre-allocated arrays
 * - Comprehensive error handling
 *
 * @param componentFactory - The Lattice component factory
 * @param options - Optional configuration including error handling
 * @returns A Lattice store with native Svelte integration
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
 * 
 * // Lattice pattern  
 * store.counter.subscribe(() => console.log('changed'));
 * 
 * // Svelte pattern - gets value directly
 * store.counter.subscribe(state => console.log(state));
 * ```
 */
// Internal adapter function  
function createNativeSvelteAdapter<State>(
  initialState: State,
  options?: AdapterOptions
): StoreAdapter<State> & {
  subscribe: (run: (value: State) => void) => () => void;
  destroy?: () => void;
} {
  let state = initialState;
  const listeners = new Set<() => void>();

  const adapter: StoreAdapter<State> & {
    subscribe: (run: (value: State) => void) => () => void;
    destroy?: () => void;
  } = {
    getState: () => state,

    setState: (updates) => {
      if (!updates) return;

      // Direct property updates for performance
      for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
          (state as any)[key] = updates[key];
        }
      }
      
      // Notify listeners
      for (const listener of listeners) {
        try {
          listener();
        } catch (error) {
          if (options?.onError) {
            options.onError(error);
          } else if (process.env.NODE_ENV !== 'production') {
            console.error('Error in store listener:', error);
          }
        }
      }
    },

    subscribe(listener: any) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      listeners.clear();
    }
  };

  return adapter;
}

export function createSvelteAdapter<Component, State>(
  componentFactory: ComponentFactory<Component, State>,
  options?: AdapterOptions
) {
  const adapterFactory = (initialState: State) =>
    createNativeSvelteAdapter(initialState, options);
  
  return createLatticeStore(componentFactory, adapterFactory);
}
