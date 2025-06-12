/**
 * @fileoverview Adapter test suite for store-react adapter
 *
 * Ensures the store-react adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core';
import { createStoreAdapter } from './index';

// Create a factory that matches the expected signature
const createTestAdapter = <State>(initialState?: State) => {
  // Use a default empty object if no initial state provided
  const state = initialState ?? ({} as State);
  return createStoreAdapter<State>()(state);
};

// Run the shared adapter test suite
createAdapterTestSuite('store-react', createTestAdapter);
