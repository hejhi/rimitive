/**
 * @fileoverview Full-featured lattice context
 *
 * Provides a context with all signal features pre-configured.
 * For tree-shakeable builds, use createContext with individual extensions.
 */

import type { LatticeContext } from './types';
import { createContext } from './extension';
import { signalExtension } from './extensions/signal';
import { computedExtension } from './extensions/computed';
import { effectExtension } from './extensions/effect';
import { batchExtension } from './extensions/batch';
import { selectExtension } from './extensions/select';
import { subscribeExtension } from './extensions/subscribe';

/**
 * All core extensions bundled together
 */
export const coreExtensions = [
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension,
  subscribeExtension,
] as const;

/**
 * Creates a full-featured lattice context with all signal utilities
 * 
 * @example
 * ```typescript
 * import { createLattice } from '@lattice/lattice';
 * 
 * const context = createLattice();
 * const count = context.signal(0);
 * const doubled = context.computed(() => count.value * 2);
 * 
 * // All features available: signal, computed, effect, batch, select, subscribe
 * ```
 */
export function createLattice(): LatticeContext {
  return createContext(...coreExtensions) as LatticeContext;
}