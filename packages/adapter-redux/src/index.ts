/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides a minimal adapter that wraps existing Redux stores for use with Lattice.
 * The adapter preserves all Redux features including middleware, DevTools, and time-travel debugging.
 */

import type { Store } from 'redux';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for the Redux adapter
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Wraps an existing Redux store for use with Lattice components.
 * 
 * This adapter allows you to use any Redux store with Lattice, preserving
 * all Redux features like middleware, DevTools, and time-travel debugging.
 * 
 * @param store - An existing Redux store instance
 * @param options - Optional configuration
 * @returns A RuntimeSliceFactory for creating slices
 * 
 * @example
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { reduxAdapter } from '@lattice/adapter-redux';
 * 
 * // Create Redux store with native API
 * const store = configureStore({
 *   reducer: {
 *     counter: counterReducer,
 *     todos: todosReducer
 *   }
 * });
 * 
 * // Wrap with adapter
 * const createSlice = reduxAdapter(store);
 * 
 * // Create Lattice component
 * const counter = createSlice(({ get, set }) => ({
 *   count: () => get().counter.value,
 *   increment: () => set({ 
 *     counter: { ...get().counter, value: get().counter.value + 1 } 
 *   })
 * }));
 * ```
 */
export function reduxAdapter<State>(
  store: Store<State>,
  options?: AdapterOptions
): RuntimeSliceFactory<State> {
  const adapter = createReduxAdapter(store, options);
  return createLatticeStore(adapter);
}

/**
 * Creates a minimal adapter from a Redux store.
 * 
 * This handles the core adapter interface while managing edge cases
 * like unsubscribing during notifications and error isolation.
 * 
 * @param store - The Redux store to wrap
 * @param options - Optional configuration
 * @returns A StoreAdapter instance
 */
function createReduxAdapter<State>(
  store: Store<State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Track listeners separately from Redux's subscription
  const listeners = new Set<() => void>();
  const pendingUnsubscribes = new Set<() => void>();
  let isNotifying = false;

  // Error handling
  const handleError = options?.onError ?? ((error) => {
    console.error('Error in store listener:', error);
  });

  // Subscribe to Redux store once
  store.subscribe(() => {
    isNotifying = true;

    // Notify all listeners
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        handleError(error);
      }
    }

    isNotifying = false;

    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => store.getState(),
    setState: (updates) => {
      // For Redux, we need to dispatch a special action that merges state
      // The reducer must handle this action type
      store.dispatch({ type: '@@LATTICE/SET_STATE', payload: updates });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        if (isNotifying) {
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
  };
}

// Re-export types for convenience
export type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';