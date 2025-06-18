/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides a clean adapter pattern for integrating existing Redux stores
 * with Lattice components. Users create their stores with Redux's native
 * API and wrap them with this adapter.
 */

import type { Store } from 'redux';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';
import { createSlice as createReduxSlice } from '@reduxjs/toolkit';

/**
 * Configuration options for the Redux adapter
 */
export interface ReduxAdapterOptions {
  /**
   * The slice of the Redux state to use for Lattice.
   * If not provided, the entire Redux state is used.
   */
  slice?: string;

  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Lattice reducer that handles generic state updates.
 * Include this in your Redux store configuration to enable Lattice integration.
 *
 * @example
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { latticeReducer } from '@lattice/adapter-redux';
 *
 * const store = configureStore({
 *   reducer: latticeReducer.reducer,
 *   preloadedState: { count: 0 }
 * });
 * ```
 */
export const latticeReducer = createReduxSlice({
  name: 'lattice',
  initialState: {} as any,
  reducers: {
    /**
     * Updates the state with partial updates
     */
    updateState: (state, action) => {
      // Use Object.assign for optimal Immer performance
      // Immer tracks mutations and handles immutability
      Object.assign(state, action.payload);
    },

    /**
     * Replaces the entire state
     */
    replaceState: (_state, action) => {
      return action.payload;
    },

    /**
     * Updates a nested path in the state
     */
    updateNested: (state, action) => {
      const { path, value } = action.payload;

      if (path.length === 0) {
        return value;
      }

      // Use Immer's draft state for efficient nested updates
      let current: any = state;

      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        current = current[key];
      }

      current[path[path.length - 1]] = value;
    },
  },
});

/**
 * Creates a Lattice adapter from an existing Redux store.
 *
 * This adapter wraps any Redux store to work seamlessly with Lattice components.
 * The store must include the latticeReducer to handle state updates from Lattice.
 *
 * @param store - An existing Redux store
 * @param options - Optional configuration for slice selection and error handling
 * @returns A RuntimeSliceFactory for creating Lattice slices
 *
 * @example Basic usage
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
 *
 * // Create a Redux store with Lattice reducer
 * const store = configureStore({
 *   reducer: latticeReducer.reducer,
 *   preloadedState: { count: 0, user: { name: '' } }
 * });
 *
 * // Wrap it for use with Lattice components
 * const createSlice = reduxAdapter(store);
 *
 * // Use in a Lattice component
 * const counter = createSlice(({ get, set }) => ({
 *   value: () => get().count,
 *   increment: () => set({ count: get().count + 1 })
 * }));
 * ```
 *
 * @example With middleware and multiple slices
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
 * import logger from 'redux-logger';
 *
 * const store = configureStore({
 *   reducer: {
 *     app: latticeReducer.reducer,
 *     auth: authSlice.reducer,
 *     api: apiSlice.reducer
 *   },
 *   middleware: (getDefaultMiddleware) =>
 *     getDefaultMiddleware().concat(logger),
 *   devTools: process.env.NODE_ENV !== 'production'
 * });
 *
 * // Specify which slice to use for Lattice
 * const createSlice = reduxAdapter(store, { slice: 'app' });
 * ```
 */
export function reduxAdapter<State>(
  store: Store,
  options?: ReduxAdapterOptions
): RuntimeSliceFactory<State> {
  const slicePath = options?.slice;
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Performance optimization: Direct listener management
  const listeners = new Set<() => void>();
  const pendingUnsubscribes = new Set<() => void>();
  let isNotifying = false;

  // Subscribe to Redux store once
  store.subscribe(() => {
    isNotifying = true;

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

  const adapter: StoreAdapter<State> = {
    getState: () => {
      const state = store.getState();
      // If a slice is specified, return only that part of the state
      return slicePath ? (state as any)[slicePath] : (state as State);
    },

    setState: (updates: Partial<State>) => {
      // Always dispatch the updateState action
      // The reducer will handle the actual state update
      store.dispatch(latticeReducer.actions.updateState(updates));
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

  return createLatticeStore(adapter);
}

// Re-export types for convenience
export type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
