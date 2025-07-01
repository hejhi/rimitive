/**
 * @fileoverview Computed signal implementation for derived reactive values
 *
 * Provides computed signals that automatically track dependencies and
 * recompute when those dependencies change.
 */

import type { Computed } from '../component/types';
import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';

/**
 * Creates a computed factory bound to the given tracking and batching contexts
 */
export function createComputedFactory(
  tracking: TrackingContext,
  batching: BatchingSystem
) {
  /**
   * Creates a computed signal that derives its value from other signals
   * Dependencies are tracked automatically when the computation runs
   */
  return function computed<T>(computeFn: () => T): Computed<T> {
    let value: T;
    let isStale = true;
    let isComputing = false; // Prevent infinite recomputation loops
    let unsubscribers: (() => void)[] = [];
    const listeners = new Set<() => void>();

    const recompute = () => {
      if (isComputing) return; // Prevent infinite loops
      isComputing = true;

      try {
        // Clean up old dependency subscriptions
        for (const unsub of unsubscribers) {
          unsub();
        }
        unsubscribers = [];

        // Track dependencies during computation
        const { value: newValue, deps } = tracking.capture(computeFn);
        value = newValue;

        // Subscribe to new dependencies
        for (const dep of deps) {
          const unsub = dep.subscribe(() => {
            if (isComputing) return;

            // Only mark stale if not currently computing
            isStale = true;

            // Use notification guard to prevent re-entrant updates
            batching.notify(() => {
              for (const listener of listeners) {
                batching.scheduleUpdate(listener);
              }
            });
          });
          unsubscribers.push(unsub);
        }

        isStale = false;
      } finally {
        isComputing = false;
      }
    };

    const comp = (() => {
      // Register this computed as a dependency if we're in a tracking context
      tracking.track(comp);

      // During notification phase, return stale value to prevent re-entrant reads
      if (batching.notifying) return value;

      // Recompute if stale
      if (isStale && !isComputing) recompute();

      return value;
    }) as Computed<T>;

    comp.subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    return comp;
  };
}
