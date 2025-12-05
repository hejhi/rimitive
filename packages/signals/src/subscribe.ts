/**
 * Subscribe Extension - Scheduled callback-based reactive updates
 *
 * Like effects, subscriptions are scheduled and batched, but they only
 * track dependencies from the source function, not from the callback.
 * This provides efficient updates when you want to react to specific
 * signals without tracking all dependencies used in the callback.
 *
 * Use cases:
 * - UI updates that depend on a specific signal
 * - Derived computations that should only update on specific triggers
 * - Selective dependency tracking for performance
 */

import type { ScheduledNode } from './types';
import type {
  ServiceContext,
  InstrumentationContext,
  ServiceDefinition,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './helpers/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

/**
 * Internal dependencies required by the Subscribe factory.
 * These are wired automatically by presets - users don't need to provide them.
 * @internal
 */
type SubscribeDeps = {
  track: GraphEdges['track'];
  detachAll: GraphEdges['detachAll'];
  dispose: Scheduler['dispose'];
};

export type SubscribeFunction = {
  <T = unknown>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction;
};

/**
 * Options for customizing Subscribe behavior.
 * Pass to Subscribe() when creating a custom service composition.
 */
export type SubscribeOptions = {
  instrument?: (
    impl: SubscribeFunction,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => SubscribeFunction;
};

export type SubscribeCallback<T> = (value: T) => void;
export type UnsubscribeFunction = () => void;

export type SubscribeFactory = ServiceDefinition<
  'subscribe',
  SubscribeFunction
>;

// Re-export types needed for type inference
export type { GraphEdges } from './helpers/graph-edges';
export type { Scheduler } from './helpers/scheduler';

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
