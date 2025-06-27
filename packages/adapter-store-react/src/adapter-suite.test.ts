/**
 * @fileoverview Adapter test suite for store-react adapter
 *
 * Ensures the store-react adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';
import { createStore, storeReactAdapter } from './index';

// Create a factory that matches the expected signature
const createTestAdapter = <State>(initialState?: State) => {
  // Use a default empty object if no initial state provided
  const state = initialState ?? ({} as State);
  const store = createStore(state);
  return storeReactAdapter(store);
};

// Run the shared adapter test suite
createAdapterTestSuite('store-react', createTestAdapter);
