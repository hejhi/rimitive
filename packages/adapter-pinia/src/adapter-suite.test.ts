/**
 * @fileoverview Adapter test suite for Pinia adapter
 * 
 * Ensures the Pinia adapter conforms to the Lattice adapter contract
 */

import { beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createStoreAdapter } from './index';
import { createAdapterTestSuite } from '@lattice/core';

// Setup Pinia before running tests
beforeEach(() => {
  // Create a fresh Pinia instance for each test
  setActivePinia(createPinia());
});

// Run the shared adapter test suite
createAdapterTestSuite('Pinia', createStoreAdapter);
