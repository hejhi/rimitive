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
import { NodeScheduler } from './helpers/node-scheduler';
import { CONSTANTS } from './constants';

const { STATUS_CLEAN } = CONSTANTS;

export type SubscribeOpts = {
  ctx: GlobalContext;
  graphEdges: GraphEdges;
  nodeScheduler: NodeScheduler;
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
    graphEdges: { track, detachAll },
    nodeScheduler: { enqueue, dispose: disposeNode },
  } = opts;

  function subscribe<T>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction {
    const flush = (node: SubscriptionNode<T>) => {
      const value = track(ctx, node, source); // Track source dependencies
      callback(value); // Don't track callback dependencies
    }

    const schedule = (node: ScheduledNode) => {
      if (enqueue(node)) return;
      flush(node as SubscriptionNode<T>);
    };

    // Create subscription node
    const node: SubscriptionNode<T> = {
      __type: 'subscription' as const,
      callback,
      source,
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      nextScheduled: undefined,
      schedule,
      flush,
    };

    // Initial execution to establish dependencies and get initial value
    flush(node);

    // Return unsubscribe function
    return () => {
      disposeNode(node, (node) => {
        detachAll(node);
      });
    };
  }

  return {
    name: 'subscribe',
    method: subscribe
  };
}