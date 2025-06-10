/**
 * @fileoverview Minimal Redux adapter for Lattice
 *
 * This adapter follows the minimal adapter pattern, providing only the
 * store primitives needed by the Lattice runtime.
 */

import {
  configureStore,
  createSlice as createReduxSlice,
} from '@reduxjs/toolkit';
import type { StoreAdapter, ComponentFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Creates a minimal Redux adapter
 *
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createStoreAdapter<Model>(
  initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create Redux slice for state management
  const slice = createReduxSlice({
    name: 'lattice',
    initialState: (initialState || {}) as Model,
    reducers: {
      updateState: (state, action) => {
        // Type assertion needed due to Immer's Draft type
        Object.assign(state as any, action.payload);
      },
    },
  });

  // Create Redux store
  const store = configureStore({
    reducer: slice.reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });

  return {
    getState: () => store.getState() as Model,
    setState: (updates) => {
      store.dispatch(slice.actions.updateState(updates));
    },
    subscribe: (listener) => store.subscribe(listener),
  };
}

/**
 * Creates a Redux adapter for a Lattice component.
 *
 * This is the primary way to use Lattice with Redux. It combines
 * a component specification with Redux's state management.
 *
 * @param componentFactory - The Lattice component spec factory
 * @returns A Lattice store backed by Redux
 *
 * @example
 * ```typescript
 * const counter = () => ({
 *   model: createModel(...),
 *   actions: createSlice(...),
 *   views: { ... }
 * });
 *
 * const store = createReduxAdapter(counter);
 * store.actions.increment();
 * const view = store.views.display();
 * ```
 */
export function createReduxAdapter<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>
) {
  // Use the runtime to create the store
  return createLatticeStore(componentFactory, createStoreAdapter<Model>());
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
