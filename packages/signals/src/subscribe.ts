/**
 * Subscribe Extension - Eager callback-based reactive updates
 *
 * Unlike effects which are scheduled and batched, subscriptions execute
 * immediately and synchronously when their source changes. This provides
 * lower latency at the cost of potentially more computations.
 *
 * Use cases:
 * - UI updates that need immediate feedback
 * - Debug logging
 * - External system integration
 * - Performance-critical hot paths where scheduling overhead matters
 */

import type { ConsumerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';

const { STATUS_DISPOSED } = CONSTANTS;

export type SubscribeOpts = {
  ctx: GlobalContext;
  graphEdges: GraphEdges;
};

export type SubscribeCallback<T> = (value: T) => void;
export type UnsubscribeFunction = () => void;

// Subscription node that acts like an effect but executes eagerly
interface SubscriptionNode<T> extends ConsumerNode {
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
    graphEdges: { startTracking, endTracking, detachAll },
  } = opts;

  function subscribe<T>(
    source: () => T,
    callback: SubscribeCallback<T>
  ): UnsubscribeFunction {
    const notify = (node: ConsumerNode) => {
      if (node.flags & STATUS_DISPOSED) return;

      const prevConsumer = startTracking(ctx, node);
      const value = source();
      endTracking(ctx, node, prevConsumer);

      callback(value); // Call this OUTSIDE of tracking, don't track callback deps
    }

    // Create subscription node
    const node: SubscriptionNode<T> = {
      __type: 'subscription',
      callback,
      source,
      flags: 0,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      notify,
    };

    // Establish initial dependencies and get initial value
    notify(node);

    // Return unsubscribe function
    return () => {
      if (node.flags & STATUS_DISPOSED) return;
      node.flags = STATUS_DISPOSED;
      detachAll(node);
    };
  }

  return {
    name: 'subscribe',
    method: subscribe
  };
}