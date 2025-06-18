/**
 * @fileoverview Redux adapter for Lattice
 *
 * Provides automatic Redux store creation from pure Lattice slice definitions.
 * The adapter preserves all Redux features including middleware, DevTools, and time-travel debugging.
 */

import type { Store } from 'redux';
import type { RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';
import { createSlice as createReduxSlice, configureStore } from '@reduxjs/toolkit';

/**
 * Creates a Redux store that automatically handles Lattice-style updates
 * 
 * @param initialState - The initial state for the Redux store
 * @returns An object with the Redux store and a createSlice function for Lattice
 * 
 * @example
 * ```typescript
 * const { store, createSlice } = createStore({ count: 0 });
 * 
 * const counter = createSlice(({ get, set }) => ({
 *   value: () => get().count,
 *   increment: () => set({ count: get().count + 1 })
 * }));
 * ```
 */
export function createStore<State extends Record<string, any>>(
  initialState: State
): {
  store: Store<State>;
  createSlice: RuntimeSliceFactory<State>;
} {
  // Create a meta-slice that can handle any state update
  const metaSlice = createReduxSlice({
    name: 'lattice',
    initialState,
    reducers: {
      // Generic reducer that can update any part of the state
      updateState: (state, action) => {
        const { path, value } = action.payload;

        if (path.length === 0) {
          // Full state replacement
          return value;
        }

        // Deep update for nested paths
        const newState = { ...state };
        let current: any = newState;

        for (let i = 0; i < path.length - 1; i++) {
          const key = path[i];
          current[key] = { ...current[key] };
          current = current[key];
        }

        current[path[path.length - 1]] = value;
        return newState;
      },

      // Batch update for multiple paths
      batchUpdate: (state, action) => {
        const updates = action.payload;
        const newState = { ...state };

        for (const [key, value] of Object.entries(updates)) {
          (newState as any)[key] = value;
        }

        return newState;
      },
    },
  });

  // Create Redux store
  const store = configureStore({
    reducer: metaSlice.reducer,
  });

  // Track listeners separately to handle errors
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();
  
  // Subscribe to Redux store and notify listeners with error handling
  store.subscribe(() => {
    isNotifying = true;
    
    // Make a copy of listeners to avoid modification during iteration
    const currentListeners = Array.from(listeners);
    
    for (const listener of currentListeners) {
      try {
        listener();
      } catch (error) {
        // Log error but continue notifying other listeners
        console.error('Error in store listener:', error);
      }
    }
    
    isNotifying = false;
    
    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  // Create a custom adapter that intercepts set() calls
  const adapter = {
    getState: () => store.getState(),
    setState: (updates: Partial<State>) => {
      // Dispatch the batch update action
      store.dispatch(metaSlice.actions.batchUpdate(updates));
    },
    subscribe: (listener: () => void) => {
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

  // Create the Lattice store factory using the core function
  const createSlice = createLatticeStore(adapter);

  return { store, createSlice };
}

// Re-export types for convenience
export type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';