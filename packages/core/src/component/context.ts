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
  createSignalFactory,
  createComputedFactory,
  createEffectFactory,
  createBatchFunction,
} from '../primitives/signals/lattice-integration';

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

  // Create bound factory functions using signals
  const signal = createSignalFactory();
  const computed = createComputedFactory();
  const effect = createEffectFactory();

  // Placeholder set function - will be provided when creating store
  const set: SetState = () => {
    throw new Error(
      'set() is only available when component is connected to a store'
    );
  };

  // Create signal batch function
  const batch = createBatchFunction();

  return {
    signal,
    computed,
    effect,
    set,
    // Internal method for store integration - use signal batch
    _batch: batch,
    _tracking: tracking,
    _batching: batching,
  };
}
