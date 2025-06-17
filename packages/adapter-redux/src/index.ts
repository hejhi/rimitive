/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides a minimal adapter that wraps existing Redux stores for use with Lattice.
 * The adapter preserves all Redux features including middleware, DevTools, and time-travel debugging.
 */

import type { Store, AnyAction } from 'redux';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Maps state keys to Redux action creators
 */
export type ActionMapping<State> = {
  [K in keyof State]?: (value: State[K]) => AnyAction;
};

/**
 * Configuration options for the Redux adapter
 */
export interface ReduxAdapterOptions<State = any> {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;

  /**
   * Maps state keys to Redux action creators.
   * When setState is called with a key, the corresponding action creator is invoked.
   *
   * @example
   * ```typescript
   * const actionMapping = {
   *   count: (value) => counterSlice.actions.setCount(value),
   *   user: (updates) => userSlice.actions.updateUser(updates),
   *   'todos.items': (items) => todosSlice.actions.setTodos(items)
   * };
   * ```
   */
  actionMapping?: ActionMapping<State>;
}

/**
 * Wraps an existing Redux store for use with Lattice components.
 *
 * This adapter allows you to use any Redux store with Lattice, preserving
 * all Redux features like middleware, DevTools, and time-travel debugging.
 *
 * @param store - An existing Redux store instance
 * @param options - Optional configuration including action mapping
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
 * // Create action mapping
 * const actionMapping = {
 *   counter: (value) => ({ type: 'counter/set', payload: value }),
 *   todos: (value) => ({ type: 'todos/set', payload: value })
 * };
 *
 * // Wrap with adapter
 * const createSlice = reduxAdapter(store, { actionMapping });
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
  options?: ReduxAdapterOptions<State>
): RuntimeSliceFactory<State> {
  const adapter = createReduxAdapter(store, options);
  return createLatticeStore(adapter);
}

/**
 * Creates a minimal adapter from a Redux store with action mapping support.
 *
 * @param store - The Redux store to wrap
 * @param options - Optional configuration including action mapping
 * @returns A StoreAdapter instance
 */
function createReduxAdapter<State>(
  store: Store<State>,
  options?: ReduxAdapterOptions<State>
): StoreAdapter<State> {
  const { actionMapping = {}, onError } = options ?? {};

  // Track listeners separately from Redux's subscription
  const listeners = new Set<() => void>();
  const pendingUnsubscribes = new Set<() => void>();
  let isNotifying = false;

  // Error handling
  const handleError =
    onError ??
    ((error) => {
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
      // For each update, find and dispatch the mapped action
      for (const [key, value] of Object.entries(updates)) {
        const actionCreator = (actionMapping as Record<string, any>)[key];
        if (actionCreator) {
          // Dispatch the mapped action
          store.dispatch(actionCreator(value));
        }
      }
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
