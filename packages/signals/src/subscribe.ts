import type { ScheduledNode } from './types';
import type {
  ServiceContext,
  InstrumentationContext,
  ServiceDefinition,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { GraphEdges } from './deps/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './deps/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

/**
 * Dependencies required by the Subscribe factory.
 * Wired automatically by presets - only needed for custom compositions.
 * @internal
 */
export type SubscribeDeps = {
  track: GraphEdges['track'];
  detachAll: GraphEdges['detachAll'];
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

/**
 * Options for customizing Subscribe behavior.
 *
 * @example Adding instrumentation
 * ```ts
 * const subscribeService = Subscribe({
 *   instrument(impl, instr, ctx) {
 *     return (source, callback) => {
 *       const unsub = impl(source, callback);
 *       instr.emit({ type: 'subscribe:create', timestamp: Date.now(), data: {} });
 *       return unsub;
 *     };
 *   },
 * });
 * ```
 */
export type SubscribeOptions = {
  /** Custom instrumentation wrapper for debugging/profiling */
  instrument?: (
    impl: SubscribeFunction,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => SubscribeFunction;
};

/** Callback invoked when the source value changes */
export type SubscribeCallback<T> = (value: T) => void;

/** Function to stop the subscription */
export type UnsubscribeFunction = () => void;

/**
 * ServiceDefinition for the subscribe primitive.
 * This is what gets composed into a service context.
 */
export type SubscribeFactory = ServiceDefinition<
  'subscribe',
  SubscribeFunction
>;

/**
 * The instantiable service returned by Subscribe().
 *
 * @example
 * ```ts
 * import { Subscribe, type SubscribeService } from '@lattice/signals/subscribe';
 *
 * const subscribeService: SubscribeService = Subscribe();
 * const factory = subscribeService.create(deps); // SubscribeFactory
 * ```
 */
export type SubscribeService = ReturnType<typeof Subscribe>;

// Re-export types needed for type inference
export type { GraphEdges } from './deps/graph-edges';
export type { Scheduler } from './deps/scheduler';

/**
 * Create a Subscribe service factory.
 *
 * Subscribe tracks dependencies only from the source function, not the callback.
 * This is useful when you want to react to specific signals without tracking
 * all dependencies used in the callback.
 *
 * **Most users should use the preset instead:**
 * ```ts
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 * const { subscribe } = createSignalsSvc();
 * ```
 *
 * @example Basic subscription
 * ```ts
 * const { signal, subscribe } = createSignalsSvc();
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
export const Subscribe = defineService(
  ({ track, detachAll, dispose: disposeNode }: SubscribeDeps) =>
    ({ instrument }: SubscribeOptions = {}): SubscribeFactory => {
      const detachDeps = (node: ScheduledNode) => {
        const deps = node.dependencies;

        if (deps) {
          detachAll(deps);
          node.dependencies = undefined;
        }

        node.dependencyTail = undefined;
      };

      function createSubscribe<T>(
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

      const extension: SubscribeFactory = {
        name: 'subscribe',
        impl: createSubscribe,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
