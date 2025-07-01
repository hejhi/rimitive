/**
 * @fileoverview Effect implementation for reactive side effects
 *
 * Provides effects that automatically track dependencies and
 * re-execute when those dependencies change, similar to computed
 * but without returning a value.
 */

import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';

export interface EffectCleanup {
  (): void;
}

/**
 * Creates an effect factory bound to the given tracking and batching contexts
 */
export function createEffectFactory(
  tracking: TrackingContext,
  batching: BatchingSystem
) {
  /**
   * Creates an effect that runs whenever its dependencies change
   * Dependencies are tracked automatically when the effect runs
   * 
   * @param effectFn - The effect function to run
   * @returns A cleanup function to stop the effect
   */
  return function effect(effectFn: () => void | (() => void)): EffectCleanup {
    let isRunning = false;
    let unsubscribers: (() => void)[] = [];
    let cleanupFn: (() => void) | void;

    const runEffect = () => {
      if (isRunning) return; // Prevent infinite loops
      isRunning = true;

      try {
        // Run cleanup from previous execution
        if (cleanupFn) {
          cleanupFn();
        }

        // Clean up old dependency subscriptions
        for (const unsub of unsubscribers) {
          unsub();
        }
        unsubscribers = [];

        // Track dependencies during effect execution
        const { value: cleanup, deps } = tracking.capture(effectFn);
        cleanupFn = cleanup;

        // Subscribe to new dependencies
        for (const dep of deps) {
          const unsub = dep.subscribe(() => {
            if (isRunning) return;
            batching.scheduleUpdate(runEffect);
          });
          unsubscribers.push(unsub);
        }
      } finally {
        isRunning = false;
      }
    };

    // Run immediately
    runEffect();

    // Return cleanup function
    return () => {
      // Clean up subscriptions
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers = [];

      // Run final cleanup
      if (cleanupFn) {
        cleanupFn();
      }
    };
  };
}