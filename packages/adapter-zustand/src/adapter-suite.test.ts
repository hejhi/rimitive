/**
 * @fileoverview Adapter test suite for Zustand adapter
 *
 * Ensures the Zustand adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core';
import { createStoreAdapter } from './index';
import { createStore as zustandCreateStore } from 'zustand/vanilla';

// Create a factory that matches the expected signature
const createTestAdapter = <State>(initialState?: State) => {
  // Use a default empty object if no initial state provided
  const state = initialState ?? ({} as State);
  const store = zustandCreateStore<State>(() => state);
  return createStoreAdapter(store);
};

// Run the shared adapter test suite
createAdapterTestSuite('Zustand', createTestAdapter);
