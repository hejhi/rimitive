import { describe, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createPiniaAdapter } from './index';
import { createAdapterTestSuite } from '@lattice/core';

describe('Pinia Adapter Contract Tests', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  // Run the shared adapter test suite
  createAdapterTestSuite('Pinia', createPiniaAdapter);
});
