/**
 * @fileoverview Scoped lattice context implementation
 *
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext, SetState } from './runtime-types';
import { createTrackingContext } from './tracking';
import { createBatchingSystem } from './batching';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';

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

  // Create bound factory functions
  const signal = createSignalFactory(tracking, batching);
  const computed = createComputedFactory(tracking, batching);

  // Placeholder set function - will be provided when creating store
  const set: SetState = () => {
    throw new Error(
      'set() is only available when component is connected to a store'
    );
  };

  return {
    signal,
    computed,
    set,
    // Internal method for store integration
    _batch: batching.batch,
    _tracking: tracking,
    _batching: batching,
  };
}
