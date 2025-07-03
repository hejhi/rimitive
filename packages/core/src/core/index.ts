/**
 * @fileoverview Core reactive primitives exports
 * Note: These are internal implementations and not part of the public API
 */

// Signals are used for all reactive primitives
export { 
  createSignalFactory,
  createComputedFactory,
  createEffectFactory 
} from '../primitives/signals/lattice-integration';
export { createTrackingContext } from './tracking';
export { createBatchingSystem } from './batching';