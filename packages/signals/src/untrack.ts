/**
 * Untracked execution - temporarily disable reactive tracking
 */

import type { Consumer } from './deps/graph-edges';

/**
 * Options for creating the untrack helper.
 * @internal
 */
export type UntrackedOpts = {
  consumer: Consumer;
};

/**
 * Create an untrack helper function.
 *
 * The returned `untrack` function executes a callback without establishing
 * reactive dependencies. Any signals or computeds read inside the callback
 * will not be tracked.
 *
 * @example Basic usage
 * ```ts
 * const { signal, effect } = createSignals()();
 * const { untrack } = deps();
 *
 * const a = signal(1);
 * const b = signal(2);
 *
 * effect(() => {
 *   const aVal = a();                  // tracked
 *   const bVal = untrack(() => b());   // NOT tracked
 *   console.log(aVal + bVal);
 * });
 *
 * a(10); // effect re-runs
 * b(20); // effect does NOT re-run
 * ```
 *
 * @example Logging without tracking
 * ```ts
 * effect(() => {
 *   const value = count();
 *
 *   // Read debug info without creating dependency
 *   untrack(() => {
 *     console.log('Debug:', debugSignal());
 *   });
 *
 *   updateUI(value);
 * });
 * ```
 *
 * @example Initial value sampling
 * ```ts
 * const threshold = signal(10);
 *
 * effect(() => {
 *   // Only sample threshold once, don't track changes
 *   const initial = untrack(() => threshold());
 *   // ... use initial value
 * });
 * ```
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
