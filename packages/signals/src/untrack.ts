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
 * **Most users should get untrack from the deps helper:**
 * ```ts
 * import { deps } from '@lattice/signals';
 * const { untrack } = deps();
 * ```
 *
 * @example Basic usage
 * ```ts
 * import { createSignals, deps } from '@lattice/signals';
 *
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
 * const { signal, effect } = createSignals()();
 * const { untrack } = deps();
 * const count = signal(0);
 * const debugSignal = signal('info');
 *
 * effect(() => {
 *   const value = count();
 *
 *   // Read debug info without creating dependency
 *   untrack(() => {
 *     console.log('Debug:', debugSignal());
 *   });
 *
 *   console.log('Value:', value);
 * });
 * ```
 *
 * @example Initial value sampling
 * ```ts
 * const { signal, effect } = createSignals()();
 * const { untrack } = deps();
 * const threshold = signal(10);
 *
 * effect(() => {
 *   // Only sample threshold once, don't track changes
 *   const initial = untrack(() => threshold());
 *   // ... use initial value
 * });
 * ```
 *
 * @example Custom composition (advanced)
 * ```ts
 * import { createUntracked } from '@lattice/signals/extend';
 * import { createGraphEdges } from '@lattice/signals/extend';
 *
 * const edges = createGraphEdges();
 * const untrack = createUntracked({ consumer: edges.consumer });
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
