/**
 * @lattice/test-utils
 * 
 * Test utilities for Lattice components that work WITH the architecture.
 * These utilities properly execute slice factories and resolve select() markers,
 * making it easy to test Lattice components without fighting the framework.
 */

export {
  // Test adapter
  TestStore,
  createTestAdapter,
  createComponentTest,
} from './test-adapter.js';

export {
  // Test helpers
  testSlice,
  testModel,
  testView,
  createSnapshot,
  waitForState,
} from './test-helpers.js';

// Re-export types that are useful for testing
export type {
  SliceFactory,
  ModelFactory,
  ComponentFactory,
  ComponentSpec,
} from '@lattice/core';