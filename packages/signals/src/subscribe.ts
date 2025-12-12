import type { ScheduledNode } from './types';
import { defineModule } from '@lattice/lattice';
import { GraphEdgesModule, type GraphEdges } from './deps/graph-edges';
import { CONSTANTS } from './constants';
import { SchedulerModule, type Scheduler } from './deps/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

/**
 * Dependencies required by the subscribe function.
 * Wired automatically by the module system.
 * @internal
 */
export type SubscribeDeps = {
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
};

/**
 * Subscribe function type - tracks source dependencies, calls callback on change.
 *
 * @example
 * ```ts
 * const unsubscribe: UnsubscribeFunction = subscribe(
 *   () => count(),           // source: tracked
 *   (value) => log(value)    // callback: NOT tracked
 * );
 * ```
 */
export type SubscribeFunction = {
  <T = unknown>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction;
};

/** Callback invoked when the source value changes */
export type SubscribeCallback<T> = (value: T) => void;

/** Function to stop the subscription */
export type UnsubscribeFunction = () => void;

/**
 * Create a subscribe function.
 *
 * Subscribe tracks dependencies only from the source function, not the callback.
 * This is useful when you want to react to specific signals without tracking
 * all dependencies used in the callback.
 *
 * @example Basic composition
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule, SubscribeModule } from '@lattice/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule, SubscribeModule);
 * const { signal, subscribe } = svc;
 *
 * const count = signal(0);
 *
 * const unsubscribe = subscribe(
 *   () => count(),
 *   (value) => console.log(`Count: ${value}`)
 * );
 * // logs: "Count: 0"
 *
 * count(1); // logs: "Count: 1"
 * unsubscribe();
 * count(2); // no log
 * ```
 *
 * @example Selective tracking
 * ```ts
 * const count = signal(0);
 * const multiplier = signal(2);
 *
 * // Only re-runs when count changes, NOT when multiplier changes
 * subscribe(
 *   () => count(),
 *   (value) => console.log(value * multiplier())
 * );
 *
 * count(5);       // logs: 10
 * multiplier(3);  // no log (multiplier not in source)
 * count(5);       // no log (value unchanged)
 * count(6);       // logs: 18
 * ```
 *
 * @example vs Effect
 * ```ts
 * // Effect: tracks ALL dependencies
 * effect(() => {
 *   console.log(a() + b()); // re-runs when a OR b changes
 * });
 *
 * // Subscribe: tracks only source dependencies
 * subscribe(
 *   () => a(),              // only tracks a
 *   (val) => log(val + b()) // b is NOT tracked
 * );
 * ```
 */
export function createSubscribeFactory(deps: SubscribeDeps): SubscribeFunction {
  const { track, dispose: disposeNode } = deps;

  const detachDeps = (node: ScheduledNode) => {
    const deps = node.dependencies;

    if (deps) {
      // detachAll is not needed here - dispose handles it
      node.dependencies = undefined;
    }

    node.dependencyTail = undefined;
  };

  function subscribe<T>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction {
    const node = {
      __type: 'subscription' as const,
      status: CONSUMER | SCHEDULED | CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      nextScheduled: undefined,
      trackingVersion: 0, // Initialize version tracking
      flush(): void {
        const value = track(node, source);
        callback(value);
      },
    };
    const value = track(node, source); // Initial execution to establish dependencies and get initial value
    callback(value);

    // Return unsubscribe function
    return () => disposeNode(node, detachDeps);
  }

  return subscribe;
}

export const SubscribeModule = defineModule({
  name: 'subscribe',
  dependencies: [GraphEdgesModule, SchedulerModule],
  create: ({ graphEdges, scheduler }): SubscribeFunction =>
    createSubscribeFactory({
      track: graphEdges.track,
      dispose: scheduler.dispose,
    }),
});
