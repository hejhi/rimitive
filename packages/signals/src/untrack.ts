/**
 * Untracked execution - temporarily disable reactive tracking
 *
 * Useful for reading reactive values without creating dependencies.
 * Common use cases:
 * - Reading values in render functions that shouldn't re-run on changes
 * - Initializing state from reactive sources
 * - Sampling values for debugging/logging
 */

import type { GlobalContext } from './context';

export interface UntrackedOpts {
  ctx: GlobalContext;
}

/**
 * Create an untracked helper
 *
 * @example
 * ```ts
 * const untracked = createUntracked({ ctx });
 *
 * effect(() => {
 *   const a = signalA();  // Tracked
 *   const b = untrack(() => signalB());  // NOT tracked
 *   console.log(a, b);
 * });
 * ```
 */
export function createUntracked(opts: UntrackedOpts) {
  const { ctx } = opts;

  return function untrack<T>(fn: () => T): T {
    const prevConsumer = ctx.consumerScope;
    ctx.consumerScope = null;  // Disable tracking

    try {
      return fn();
    } finally {
      ctx.consumerScope = prevConsumer;  // Restore previous tracking context
    }
  };
}
