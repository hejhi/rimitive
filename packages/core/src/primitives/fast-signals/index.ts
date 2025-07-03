// Fast signals public API

export { signal, peek, untrack, writeSignal } from './signal';
export { computed, isOutdated } from './computed';
export { effect, runOnce, safeEffect } from './effect';
export { batch, startBatch, endBatch } from './batch';

// Export types
export type { Signal, Computed, Effect } from './types';

// Lattice integration
export { 
  createFastSignalFactory,
  updateFastSignalValue,
  isFastSignal,
  getFastSignal,
  isSignalSelector,
  getSourceSignal,
  setupFastSignalTracking
} from './lattice-integration';

// Testing utilities
export { getPoolSize, clearPool } from './node';
export { resetGlobalState } from './global';
export { hasPendingEffects, clearBatch } from './batch';