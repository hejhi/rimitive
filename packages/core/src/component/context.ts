/**
 * @fileoverview Scoped lattice context implementation
 *
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext, SetState } from './types';
import { createSignalFactory } from '../primitives/signals/lattice-integration';

/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext(): LatticeContext & {
  _batch: (fn: () => void) => void;
} {
  // Create bound factory functions using signals
  const scoped = createSignalFactory();

  return {
    signal: scoped.signal,
    computed: scoped.computed,
    effect: scoped.effect,
    set: scoped.set as SetState,
    // Internal method for store integration - use signal batch
    _batch: scoped.batch,
  };
}
