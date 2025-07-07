/**
 * @fileoverview Scoped lattice context implementation
 *
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext } from './types';
import { signal, computed, effect, batch } from '@lattice/signals';

/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext(): LatticeContext {
  return {
    signal,
    computed,
    effect,
    batch,
  };
}
