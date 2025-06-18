/**
 * @fileoverview Adapter test suite for Redux adapter
 *
 * Ensures the Redux adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';
import { createSlice as createReduxSlice, configureStore } from '@reduxjs/toolkit';

// Create a factory function that matches the expected signature
function createAdapter<State extends Record<string, any>>(
  initialState?: State
) {
  const state = initialState ?? ({} as State);
  
  // Create a meta-slice that can handle any state update
  const metaSlice = createReduxSlice({
    name: 'lattice',
    initialState: state,
    reducers: {
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

  // Create adapter interface
  return {
    getState: () => store.getState(),
    setState: (updates: Partial<State>) => {
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
}

// Run the shared adapter test suite
createAdapterTestSuite('Redux', createAdapter);
