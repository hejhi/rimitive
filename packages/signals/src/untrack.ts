/**
 * Untracked execution - temporarily disable reactive tracking
 *
 * Useful for reading reactive values without creating dependencies.
 * Common use cases:
 * - Reading values in render functions that shouldn't re-run on changes
 * - Initializing state from reactive sources
 * - Sampling values for debugging/logging
 */

import type { Consumer } from './helpers/graph-edges';

export interface UntrackedOpts {
  consumer: Consumer;
}

/**
 * Create an untracked helper
 */
export function createUntracked(opts: UntrackedOpts) {
  const { consumer } = opts;

  return function untrack<T>(fn: () => T): T {
    const prevConsumer = consumer.active;
    consumer.active = null; // Disable tracking

    try {
      return fn();
    } finally {
      consumer.active = prevConsumer; // Restore previous tracking context
    }
  };
}
