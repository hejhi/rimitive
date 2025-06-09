/**
 * @fileoverview Test the new minimal Zustand adapter with the adapter test suite
 */

import { createAdapterTestSuite } from '@lattice/core';
import { createZustandAdapter } from './index-new';

// Run the shared adapter test suite with the new implementation
createAdapterTestSuite('Zustand (New Minimal)', createZustandAdapter);