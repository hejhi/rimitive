/**
 * @fileoverview Adapter test suite for Redux adapter
 * 
 * Ensures the Redux adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';
import { createStoreAdapter } from './index';

// Run the shared adapter test suite
createAdapterTestSuite('Redux', createStoreAdapter);