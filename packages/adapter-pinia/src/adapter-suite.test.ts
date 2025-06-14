/**
 * @fileoverview Adapter test suite for Pinia adapter
 * 
 * Ensures the Pinia adapter conforms to the Lattice adapter contract
 */

import { beforeEach } from 'vitest';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import { createStoreAdapter } from './index';
import { createAdapterTestSuite } from '@lattice/core/testing';

// Setup Pinia before running tests
beforeEach(() => {
  // Create a fresh Pinia instance for each test
  setActivePinia(createPinia());
});

// Create adapter factory that matches the test suite expectations
const createTestAdapter = (initialState?: any) => {
  const pinia = createPinia();
  const storeId = `test-${Date.now()}-${Math.random()}`;
  
  const useStore = defineStore(storeId, {
    state: () => initialState || {},
  });
  
  const store = useStore(pinia);
  return createStoreAdapter(store as any);
};

// Run the shared adapter test suite
createAdapterTestSuite('Pinia', createTestAdapter);