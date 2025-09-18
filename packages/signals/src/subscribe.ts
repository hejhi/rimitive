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
import type { GlobalContext } from './context';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';
import { Scheduler } from './helpers/scheduler';

const { STATUS_CLEAN } = CONSTANTS;

export type SubscribeOpts = {
  ctx: GlobalContext;
  track: GraphEdges['track'];
  detachAll: GraphEdges['detachAll'];
  dispose: Scheduler['dispose'];
};

export type SubscribeCallback<T> = (value: T) => void;
export type UnsubscribeFunction = () => void;

// Subscription node that acts like an effect but only tracks source dependencies
interface SubscriptionNode<T> extends ScheduledNode {
  __type: 'subscription';
  callback: SubscribeCallback<T>;
  source: () => T;
}

export function createSubscribeFactory(
  opts: SubscribeOpts
): LatticeExtension<
  'subscribe',
  <T>(source: () => T, callback: SubscribeCallback<T>) => UnsubscribeFunction
> {
  const {
    ctx,
    track,
    detachAll,
    dispose: disposeNode,
  } = opts;

  function subscribe<T>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction {
    // Create subscription node with closures for safety
    const node: SubscriptionNode<T> = {
      __type: 'subscription' as const,
      callback,
      source,
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      nextScheduled: undefined,
      flush: () => {
        const value = track(ctx, node, source);
        callback(value);
      },
    };

    // Initial execution to establish dependencies and get initial value
    const value = track(ctx, node, source);
    callback(value);

    // Return unsubscribe function
    return () => disposeNode(node, detachAll);
  }

  return {
    name: 'subscribe',
    method: subscribe
  };
}