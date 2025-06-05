/**
 * @fileoverview Contract tests for Vue adapter
 * 
 * Ensures the Vue adapter conforms to the Lattice adapter specification
 */

import { createAdapterTestSuite } from '@lattice/core';
import { createVueAdapter } from './index';

// Run the shared adapter test suite
createAdapterTestSuite('Vue', createVueAdapter);