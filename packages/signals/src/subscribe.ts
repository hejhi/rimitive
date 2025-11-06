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
import type { LatticeExtension } from '@lattice/lattice';
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

export type SubscribeCallback<T> = (value: T) => void;
export type UnsubscribeFunction = () => void;

export const Subscribe = create((opts: SubscribeOpts) => (): LatticeExtension<
  'subscribe',
  <T>(source: () => T, callback: SubscribeCallback<T>) => UnsubscribeFunction
> => {
  const {
    track,
    detachAll,
    dispose: disposeNode,
  } = opts;

  const detachDeps = (node: ScheduledNode) => {
    const deps = node.dependencies;

    if (deps) {
      detachAll(deps);
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
      }
    }
    const value = track(node, source); // Initial execution to establish dependencies and get initial value
    callback(value);

    // Return unsubscribe function
    return () => disposeNode(node, detachDeps);
  }

  return {
    name: 'subscribe',
    method: subscribe
  };
});