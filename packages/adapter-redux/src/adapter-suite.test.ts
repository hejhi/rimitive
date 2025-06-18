/**
 * @fileoverview Adapter test suite for Redux adapter
 *
 * Ensures the Redux adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';
import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer } from './index';

// Create a factory function that matches the expected signature
function createAdapter<State extends Record<string, any>>(
  initialState?: State
) {
  const state = initialState ?? ({} as State);
  
  // Create Redux store with the lattice reducer
  const store = configureStore({
    reducer: latticeReducer.reducer,
    preloadedState: state
  });
  
  // Create the adapter but return the raw StoreAdapter, not the RuntimeSliceFactory
  const listeners = new Set<() => void>();
  const pendingUnsubscribes = new Set<() => void>();
  let isNotifying = false;
  
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
      store.dispatch(latticeReducer.actions.updateState(updates));
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
    }
  };
}

// Run the standard test suite
createAdapterTestSuite('Redux Adapter', createAdapter);