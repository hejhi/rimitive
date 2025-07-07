/**
 * @fileoverview Scoped lattice context implementation
 *
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext } from './types';
import { createSignalFactory } from '../primitives/signals/lattice-integration';

/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext(): LatticeContext {
  // Create bound factory functions using signals
  const scoped = createSignalFactory();

  return {
    signal: scoped.signal,
    computed: scoped.computed,
    effect: scoped.effect,
    batch: scoped.batch,
  };
}
