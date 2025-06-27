/**
 * @fileoverview Adapter test suite for store-react adapter
 *
 * Ensures the store-react adapter conforms to the Lattice adapter contract
 */

// TODO: Re-enable when @lattice/core/testing is available
// import { createAdapterTestSuite } from '@lattice/core/testing';
// import { createStoreAdapter } from './index';

// // Create a factory that matches the expected signature
// const createTestAdapter = <State>(initialState?: State) => {
//   // Use a default empty object if no initial state provided
//   const state = initialState ?? ({} as State);
//   return createStoreAdapter<State>()(state);
// };

// // Run the shared adapter test suite
// createAdapterTestSuite('store-react', createTestAdapter);

import { describe, it } from 'vitest';

describe('store-react adapter suite', () => {
  it.skip('adapter test suite disabled until @lattice/core/testing is available', () => {});
});
