/**
 * @fileoverview Scoped lattice context implementation
 *
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext, SetState } from './types';
import { createTrackingContext } from '../core/tracking';
import { createBatchingSystem } from '../core/batching';
import { 
  createFastSignalFactory, 
  createFastComputedFactory,
  createFastEffectFactory,
  createFastBatchFunction,
  setupFastSignalTracking 
} from '../primitives/fast-signals/lattice-integration';

/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext(): LatticeContext & {
  _batch: (fn: () => void) => void;
  _tracking: ReturnType<typeof createTrackingContext>;
  _batching: ReturnType<typeof createBatchingSystem>;
} {
  const tracking = createTrackingContext();
  const batching = createBatchingSystem();

  // Set up fast-signal tracking integration
  setupFastSignalTracking();

  // Create bound factory functions using fast-signals
  const signal = createFastSignalFactory();
  const computed = createFastComputedFactory();
  const effect = createFastEffectFactory();

  // Placeholder set function - will be provided when creating store
  const set: SetState = () => {
    throw new Error(
      'set() is only available when component is connected to a store'
    );
  };

  // Create fast-signal batch function
  const batch = createFastBatchFunction();

  return {
    signal,
    computed,
    effect,
    set,
    // Internal method for store integration - use fast-signal batch
    _batch: batch,
    _tracking: tracking,
    _batching: batching,
  };
}
