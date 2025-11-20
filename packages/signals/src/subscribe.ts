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
  ExtensionContext,
  InstrumentationContext,
  LatticeExtension,
} from '@lattice/lattice';
import { create } from '@lattice/lattice';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './helpers/scheduler';

const { CLEAN, CONSUMER, SCHEDULED } = CONSTANTS;

export type SubscribeOpts = {
  track: GraphEdges['track'];
  detachAll: GraphEdges['detachAll'];
  dispose: Scheduler['dispose'];
};

export interface SubscribeFunction {
  <T = unknown>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction;
}

export type SubscribeProps = {
  instrument?: (
    method: SubscribeFunction,
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => SubscribeFunction;
};

export type SubscribeCallback<T> = (value: T) => void;
export type UnsubscribeFunction = () => void;

export type SubscribeFactory = LatticeExtension<'subscribe', SubscribeFunction>;

// Re-export types needed for type inference
export type { GraphEdges } from './helpers/graph-edges';
export type { Scheduler } from './helpers/scheduler';

export const Subscribe = create(
  ({ track, detachAll, dispose: disposeNode }: SubscribeOpts) =>
    (props?: SubscribeProps): SubscribeFactory => {
      const { instrument } = props ?? {};
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
        method: createSubscribe,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
