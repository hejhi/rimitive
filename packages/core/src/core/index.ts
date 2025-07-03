/**
 * @fileoverview Core reactive primitives exports
 * Note: These are internal implementations and not part of the public API
 */

// Fast-signals are now used for all reactive primitives
export { 
  createFastSignalFactory as createSignalFactory,
  createFastComputedFactory as createComputedFactory,
  createFastEffectFactory as createEffectFactory 
} from '../primitives/fast-signals/lattice-integration';
export { createTrackingContext } from './tracking';
export { createBatchingSystem } from './batching';