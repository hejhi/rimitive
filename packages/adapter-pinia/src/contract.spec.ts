/**
 * @fileoverview Contract tests for Pinia adapter
 *
 * Ensures the Pinia adapter conforms to the Lattice adapter specification
 */

import { beforeEach } from 'vitest';
import { createAdapterTestSuite } from '@lattice/core';
import { createPiniaAdapter } from './index';
import { createPinia, setActivePinia } from 'pinia';

// Setup Pinia before tests
beforeEach(() => {
  setActivePinia(createPinia());
});

// Run the shared adapter test suite
// The type constraint difference is due to Pinia requiring object constraint on Model
createAdapterTestSuite(
  'Pinia',
  createPiniaAdapter as Parameters<typeof createAdapterTestSuite>[1]
);
