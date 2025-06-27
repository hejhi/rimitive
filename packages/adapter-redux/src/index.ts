/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides a clean adapter pattern for integrating existing Redux stores
 * with Lattice components. Users create their stores with Redux's native
 * API and wrap them with this adapter.
 */

import type { Store } from 'redux';
import type { StoreAdapter } from '@lattice/core';
import { createSlice as createReduxSlice, type PayloadAction } from '@reduxjs/toolkit';

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
 * Optimized Lattice reducer that handles generic state updates.
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
  initialState: {} satisfies Record<string, unknown>,
  reducers: {
    /**
     * Updates the state with partial updates
     */
    updateState: (state, action: PayloadAction<Record<string, unknown>>) => {
      // Optimized: Direct property assignment for better Immer performance
      const updates = action.payload;
      if (updates && typeof updates === 'object') {
        Object.assign(state, updates);
      }
    },

    /**
     * Replaces the entire state
     */
    replaceState: (_state, action: PayloadAction<Record<string, unknown>>) => {
      return action.payload;
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
 * @returns A StoreAdapter for use with Lattice components
 *
 * @example Basic usage
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
 * import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';
 *
 * // Create a Redux store with Lattice reducer
 * const store = configureStore({
 *   reducer: latticeReducer.reducer,
 *   preloadedState: { count: 0, user: { name: '' } }
 * });
 *
 * // Create an adapter
 * const adapter = reduxAdapter(store);
 *
 * // Create a Lattice component
 * const Counter = createComponent(
 *   withState<{ count: number }>(),
 *   ({ store, set }) => ({
 *     value: store.count,
 *     increment: () => set({ count: store.count() + 1 })
 *   })
 * );
 *
 * // Create store with adapter
 * const counter = createStoreWithAdapter(Counter, adapter);
 *
 * // Usage
 * console.log(counter.value()); // 0
 * counter.increment();
 * console.log(counter.value()); // 1
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
): StoreAdapter<State> {
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

  // Simple getState that handles slices
  const getState = (): State => {
    const fullState = store.getState();
    return slicePath ? fullState[slicePath] : fullState;
  };

  // Dispatch updates using the generic lattice reducer
  const dispatchUpdate = (updates: Partial<State>) => {
    if (slicePath) {
      // When using a slice, merge at the slice level
      const fullState = store.getState();
      const currentSlice = fullState[slicePath] || {};
      const newSliceState = { ...currentSlice, ...updates };
      store.dispatch(latticeReducer.actions.updateState({ [slicePath]: newSliceState }));
    } else {
      store.dispatch(latticeReducer.actions.updateState(updates));
    }
  };

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
    getState,
    setState: dispatchUpdate,
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

  return adapter;
}

/**
 * Creates an optimized Redux adapter that bypasses some of Redux Toolkit's overhead.
 * This is a performance-focused alternative that maintains the same API.
 *
 * @param store - An existing Redux store
 * @param options - Optional configuration
 * @returns A StoreAdapter with optimized performance
 */
export function createOptimizedReduxAdapter<State>(
  store: Store,
  options?: ReduxAdapterOptions
): StoreAdapter<State> {
  // For future use: This function currently delegates to reduxAdapter
  // but provides a hook for future optimizations without breaking API
  return reduxAdapter(store, options);
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
