/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides a clean adapter pattern for integrating existing Redux stores
 * with Lattice components. Users create their stores with Redux's native
 * API and wrap them with this adapter.
 */

import type { Store, AnyAction } from 'redux';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';
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

// Performance optimization: Pre-define action types as constants
const LATTICE_UPDATE_STATE = 'lattice/updateState' as const;

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
  initialState: {} as any,
  reducers: {
    /**
     * Updates the state with partial updates
     */
    updateState: (state, action: PayloadAction<any>) => {
      // Optimized: Direct property assignment for better Immer performance
      const updates = action.payload;
      if (updates && typeof updates === 'object') {
        for (const key in updates) {
          if (Object.prototype.hasOwnProperty.call(updates, key)) {
            (state as any)[key] = updates[key];
          }
        }
      }
    },

    /**
     * Replaces the entire state
     */
    replaceState: (_state, action: PayloadAction<any>) => {
      return action.payload;
    },

    /**
     * Updates a nested path in the state
     */
    updateNested: (state, action: PayloadAction<{ path: string[]; value: any }>) => {
      const { path, value } = action.payload;

      if (path.length === 0) {
        return value;
      }

      // Use Immer's draft state for efficient nested updates
      let current: any = state;

      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (key !== undefined) {
          current = current[key];
        }
      }

      const lastKey = path[path.length - 1];
      if (lastKey !== undefined) {
        current[lastKey] = value;
      }
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
 * // Use in a Lattice component with two-phase pattern
 * const counter = createSlice(
 *   (selectors) => ({ count: selectors.count }),
 *   ({ count }, set) => ({
 *     value: () => count(),
 *     increment: () => set(
 *       (selectors) => ({ count: selectors.count }),
 *       ({ count }) => ({ count: count() + 1 })
 *     )
 *   })
 * );
 *
 * // Usage
 * console.log(counter().value()); // 0
 * counter().increment();
 * console.log(counter().value()); // 1
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

  // Performance optimization: Pre-bind getState for slice path
  const getState = slicePath
    ? () => (store.getState() as any)[slicePath] as State
    : () => store.getState() as State;

  // Performance optimization: Create action objects directly
  // This avoids Redux Toolkit's action creator overhead
  const dispatchUpdate = (updates: Partial<State>) => {
    store.dispatch({
      type: LATTICE_UPDATE_STATE,
      payload: updates
    } as AnyAction);
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

  return createLatticeStore(adapter);
}

/**
 * Creates an optimized Redux adapter that bypasses some of Redux Toolkit's overhead.
 * This is a performance-focused alternative that maintains the same API.
 *
 * @param store - An existing Redux store
 * @param options - Optional configuration
 * @returns A RuntimeSliceFactory with optimized performance
 */
export function createOptimizedReduxAdapter<State>(
  store: Store,
  options?: ReduxAdapterOptions
): RuntimeSliceFactory<State> {
  // For future use: This function currently delegates to reduxAdapter
  // but provides a hook for future optimizations without breaking API
  return reduxAdapter(store, options);
}

// Re-export types for convenience
export type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
