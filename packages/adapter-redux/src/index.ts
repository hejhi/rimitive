/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides a clean adapter pattern for integrating existing Redux stores
 * with Lattice components. Users create their stores with Redux's native
 * API and wrap them with this adapter.
 */

import type { Store, UnknownAction } from 'redux';
import type { StoreAdapter } from '@lattice/core';

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
 * Action types for Lattice state updates
 */
const LATTICE_UPDATE_STATE = 'lattice/updateState';
const LATTICE_REPLACE_STATE = 'lattice/replaceState';

interface LatticeUpdateAction extends UnknownAction {
  type: typeof LATTICE_UPDATE_STATE;
  payload: Record<string, unknown>;
}

interface LatticeReplaceAction extends UnknownAction {
  type: typeof LATTICE_REPLACE_STATE;
  payload: Record<string, unknown>;
}

type LatticeAction = LatticeUpdateAction | LatticeReplaceAction;

/**
 * Creates a properly typed Lattice reducer for your Redux store.
 * This reducer handles generic state updates from Lattice components.
 *
 * @example
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { createLatticeReducer } from '@lattice/adapter-redux';
 *
 * type AppState = { count: number };
 * 
 * const store = configureStore({
 *   reducer: createLatticeReducer<AppState>(),
 *   preloadedState: { count: 0 }
 * });
 * ```
 */
export function createLatticeReducer<State extends Record<string, unknown> = Record<string, unknown>>(): import('redux').Reducer<State> {
  return (state = {} as State, action: unknown): State => {
    const latticeAction = action as LatticeAction;
    
    switch (latticeAction.type) {
      case LATTICE_UPDATE_STATE:
        // Simple object spread for updates
        return { ...state, ...latticeAction.payload } as State;
      
      case LATTICE_REPLACE_STATE:
        // Replace entire state
        return latticeAction.payload as State;
      
      default:
        return state;
    }
  };
}

/**
 * Action creators for internal use
 */
const latticeActions = {
  updateState: (payload: Record<string, unknown>): LatticeUpdateAction => ({
    type: LATTICE_UPDATE_STATE,
    payload
  }),
  replaceState: (payload: Record<string, unknown>): LatticeReplaceAction => ({
    type: LATTICE_REPLACE_STATE,
    payload
  })
};

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
      store.dispatch(latticeActions.updateState({ [slicePath]: newSliceState }));
    } else {
      store.dispatch(latticeActions.updateState(updates as Record<string, unknown>));
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

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
