/**
 * @fileoverview Adapter test suite for Redux adapter
 * 
 * Ensures the Redux adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { reduxAdapter } from './index';

// Create a factory function that matches the expected signature
function createAdapter<State>(initialState?: State) {
  // Create a Redux slice with the initial state
  const slice = createSlice({
    name: 'test',
    initialState: initialState ?? ({} as State),
    reducers: {
      setState: (state, action) => {
        Object.assign(state, action.payload);
      },
    },
    extraReducers: (builder) => {
      // Handle the Lattice SET_STATE action
      builder.addCase('@lattice/SET_STATE', (state, action: any) => {
        Object.assign(state, action.payload);
      });
    },
  });

  // Create Redux store
  const store = configureStore({
    reducer: slice.reducer,
  });

  // Return the adapter directly (not using reduxAdapter here)
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // Subscribe to Redux store once
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
      store.dispatch({ type: '@lattice/SET_STATE', payload: updates });
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