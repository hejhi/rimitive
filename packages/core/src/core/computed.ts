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
 * State machine states for computed values
 */
enum ComputedState {
  /** Value is up-to-date with current dependencies */
  FRESH = 'FRESH',
  /** Dependencies changed, value needs recomputation */
  STALE = 'STALE',
  /** Currently recomputing the value */
  COMPUTING = 'COMPUTING',
}

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
    let state = ComputedState.STALE;
    let unsubscribers: (() => void)[] = [];
    const listeners = new Set<() => void>();

    const recompute = () => {
      if (state === ComputedState.COMPUTING) return; // Prevent infinite loops
      state = ComputedState.COMPUTING;

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
            // Don't mark stale while computing
            if (state === ComputedState.COMPUTING) return;

            state = ComputedState.STALE;

            // Use notification guard to prevent re-entrant updates
            batching.notify(() => {
              for (const listener of listeners) {
                batching.scheduleUpdate(listener);
              }
            });
          });
          unsubscribers.push(unsub);
        }

        state = ComputedState.FRESH;
      } finally {
        // If we somehow failed, ensure we're not stuck in COMPUTING
        if (state === ComputedState.COMPUTING) {
          state = ComputedState.STALE;
        }
      }
    };

    const comp = (() => {
      // Register this computed as a dependency if we're in a tracking context
      tracking.track(comp);

      // During notification phase, return stale value to prevent re-entrant reads
      if (batching.notifying) return value;

      // Recompute if stale
      if (state === ComputedState.STALE) recompute();

      return value;
    }) as Computed<T>;

    comp.subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    return comp;
  };
}
