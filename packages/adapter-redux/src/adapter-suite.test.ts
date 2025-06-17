/**
 * @fileoverview Adapter test suite for Redux adapter
 * 
 * Ensures the Redux adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';
import { configureStore, createSlice } from '@reduxjs/toolkit';

// Create a factory function that matches the expected signature
function createAdapter<State extends Record<string, any>>(initialState?: State) {
  // Create a simple Redux slice like a user would
  const slice = createSlice({
    name: 'test',
    initialState: initialState ?? ({} as State),
    reducers: {
      updateState: (state, action) => {
        // Redux Toolkit uses Immer, so we can mutate
        for (const [key, value] of Object.entries(action.payload)) {
          (state as any)[key] = value;
        }
      }
    }
  });

  // Create Redux store
  const store = configureStore({
    reducer: slice.reducer
  });

  // Create simple action mapping
  const actionMapping: Record<string, any> = {};
  
  // For each key in initial state, map to the updateState action
  if (initialState) {
    for (const key of Object.keys(initialState)) {
      actionMapping[key] = (value: any) => slice.actions.updateState({ [key]: value });
    }
  }

  // Use the adapter but return the raw interface for testing
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  store.subscribe(() => {
    isNotifying = true;
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    }
    isNotifying = false;
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => store.getState() as State,
    setState: (updates: Partial<State>) => {
      // Just dispatch the update action
      store.dispatch(slice.actions.updateState(updates));
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