// Signals public API

export { signal, peek, untrack, writeSignal } from './signal';
export { computed, isOutdated } from './computed';
export { effect, runOnce, safeEffect } from './effect';
export { batch, startBatch, endBatch } from './batch';
export { subscribe } from './subscribe';

// Export types
export type { Signal, Computed, Effect } from './types';

// Lattice integration
export { 
  createSignalFactory,
  createComputedFactory,
  createEffectFactory,
  createBatchFunction,
  updateSignalValue,
  isSignal
} from './lattice-integration';

// Testing utilities
export { getPoolSize, clearPool } from './node';
export { resetGlobalState } from './global';
export { hasPendingEffects, clearBatch } from './batch';