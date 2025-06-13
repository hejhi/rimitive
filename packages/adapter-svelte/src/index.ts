/**
 * @fileoverview Svelte 5 optimized adapter for Lattice
 *
 * This adapter minimizes overhead by using direct state management
 * without wrapping Svelte stores, optimized for Svelte 5.
 */

import type {
  StoreAdapter,
  ComponentFactory,
} from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Svelte adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Extended adapter interface
 */
export interface SvelteAdapter<State> extends StoreAdapter<State> {
  /**
   * Cleanup function to prevent memory leaks
   */
  destroy(): void;
}

/**
 * Creates a Svelte adapter for a Lattice component.
 *
 * This adapter uses direct state management for minimal overhead,
 * optimized for Svelte 5's reactivity system.
 *
 * @param componentFactory - The Lattice component factory
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by optimized state management
 *
 * @example
 * ```typescript
 * const createComponent = (createStore: CreateStore) => {
 *   const createSlice = createStore({ count: 0 });
 *
 *   const counter = createSlice(({ get, set }) => ({
 *     count: () => get().count,
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
  let adapter: SvelteAdapter<State> | undefined;

  // Create an adapter factory that will be called with initial state
  const adapterFactory = (initialState: State): StoreAdapter<State> => {
    adapter = createStoreAdapter(initialState, options);
    return adapter;
  };

  const store = createLatticeStore(componentFactory, adapterFactory);

  // Add destroy method
  return Object.assign(store, {
    destroy: () => adapter?.destroy()
  });
}

/**
 * Creates a minimal adapter with direct state management
 *
 * This implementation avoids store wrapping for optimal performance
 * with Svelte 5's reactivity system.
 *
 * @param initialState - The initial state
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with cleanup
 */
export function createStoreAdapter<State>(
  initialState: State,
  options?: AdapterOptions
): SvelteAdapter<State> {
  // Direct state management without wrapper overhead
  let state = initialState;
  const listeners = new Set<() => void>();
  
  // For error handling
  const handleError = options?.onError ?? ((error) => {
    console.error('Error in store listener:', error);
  });

  return {
    getState: () => state,
    setState: (updates) => {
      // Skip update entirely if updates is empty
      const updateKeys = Object.keys(updates);
      if (updateKeys.length === 0) return;
      
      // Always update state and notify listeners
      // The adapter contract expects listeners to be called even if values are the same
      state = { ...state, ...updates };
      
      // Create a copy of listeners to handle unsubscribe during notification
      const currentListeners = Array.from(listeners);
      
      // Notify listeners
      currentListeners.forEach(listener => {
        try {
          listener();
        } catch (error) {
          handleError(error);
        }
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      listeners.clear();
    }
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';