/**
 * @fileoverview Adapter test suite for Zustand adapter
 * 
 * Ensures the Zustand adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core';
import { createStoreAdapter } from './index';

// Run the shared adapter test suite
createAdapterTestSuite('Zustand', createStoreAdapter);