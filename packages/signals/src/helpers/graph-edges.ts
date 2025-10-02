import { GlobalContext } from '../context';
import type { ProducerNode, ConsumerNode, ToNode, FromNode, Dependency } from '../types';
import { CONSTANTS } from '../constants';

const { STATUS_CLEAN } = CONSTANTS;

// Re-export types for proper type inference
export type { ProducerNode, ConsumerNode, Dependency } from '../types';

export interface GraphEdges {
  trackDependency: (
    producer: ProducerNode,
    consumer: ConsumerNode,
  ) => void;
  detachAll: (dependency: Dependency) => void;
  track: <T>(
    ctx: GlobalContext,
    node: ConsumerNode,
    fn: () => T,
  ) => T;
}

export function createGraphEdges(): GraphEdges {
  const trackDependency = (producer: FromNode, consumer: ToNode): void => {
    const tail = consumer.dependencyTail;

    // Fast path: tail already points to this producer
    if (tail !== undefined && tail.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      tail.version = consumer.trackingVersion;
      return; // Already tracking
    }

    // Check next dependency in sequence
    const next = tail ? tail.nextDependency : consumer.dependencies;
    if (next !== undefined && next.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      next.version = consumer.trackingVersion;
      consumer.dependencyTail = next;
      return; // Found and reused
    }

    // Check if consumer is an effect (has flush method) or computed (has subscribers)
    const isEffect = 'flush' in consumer;

    // Create new dependency edge
    const dep: Dependency = {
      producer,
      consumer,
      prevDependency: tail,
      prevConsumer: isEffect ? producer.scheduledTail : producer.subscribersTail,
      nextDependency: next,
      nextConsumer: undefined,
      version: consumer.trackingVersion,
    };

    // Wire consumer side
    consumer.dependencyTail = dep;
    if (next) next.prevDependency = dep;
    if (tail) tail.nextDependency = dep;
    else consumer.dependencies = dep;

    // Wire producer side - route effects to scheduled list, computeds to subscribers
    if (isEffect) {
      producer.scheduledTail = dep;
      if (dep.prevConsumer) dep.prevConsumer.nextConsumer = dep;
      else producer.scheduled = dep;
    } else {
      producer.subscribersTail = dep;
      if (dep.prevConsumer) dep.prevConsumer.nextConsumer = dep;
      else producer.subscribers = dep;
    }
  };

  /**
   * Detach all dependencies from a consumer node.
   * Used during disposal to completely disconnect a node from the graph.
   */
  const detachAll = (dep: Dependency): void => {
    let current: Dependency | undefined = dep;

    do {
      const next: Dependency | undefined = current.nextDependency;
      const { producer, consumer, prevDependency, prevConsumer, nextConsumer } =
        current;

      // Unlink from consumer chain
      if (next) next.prevDependency = prevDependency;
      else consumer.dependencyTail = prevDependency;

      if (prevDependency) prevDependency.nextDependency = next;
      else consumer.dependencies = next;

      // Unlink from producer chain - handle both scheduled and subscribers lists
      const isEffect = 'flush' in consumer;
      if (nextConsumer) nextConsumer.prevConsumer = prevConsumer;
      else if (isEffect) producer.scheduledTail = prevConsumer;
      else producer.subscribersTail = prevConsumer;

      if (prevConsumer) prevConsumer.nextConsumer = nextConsumer;
      else if (isEffect) producer.scheduled = nextConsumer;
      else producer.subscribers = nextConsumer;

      current = next;
    } while (current);
  };

  const track = <T>(
    ctx: GlobalContext,
    node: ConsumerNode,
    fn: () => T,
  ): T => {
    node.trackingVersion++;

    // Clear dirty and pending flags before tracking
    node.status = STATUS_CLEAN;

    const prevConsumer = ctx.consumerScope;
    node.dependencyTail = undefined;
    ctx.consumerScope = node;

    try {
      return fn();
    } finally {
      ctx.consumerScope = prevConsumer;

      // Prune stale dependencies (everything after dependencyTail)
      // dependencyTail marks the last dependency accessed in this tracking cycle
      // Anything after it is stale and should be removed

      const tail = node.dependencyTail as Dependency | undefined;

      // Unlink from producer chain - handle both scheduled and subscribers lists
      const isEffect = 'flush' in node;

      if (tail) {
        // Prune everything after tail
        let toRemove = tail.nextDependency;
        if (toRemove !== undefined) {
          do {
            const next: Dependency | undefined = toRemove.nextDependency;
            const { producer, prevConsumer, nextConsumer } = toRemove;

            // Unlink from consumer chain
            if (next !== undefined) next.prevDependency = tail;
            // tail already points to the correct position, no update needed
            tail.nextDependency = next;

            if (nextConsumer !== undefined)
              nextConsumer.prevConsumer = prevConsumer;
            else if (isEffect) producer.scheduledTail = prevConsumer;
            else producer.subscribersTail = prevConsumer;

            if (prevConsumer !== undefined)
              prevConsumer.nextConsumer = nextConsumer;
            else if (isEffect) producer.scheduled = nextConsumer;
            else producer.subscribers = nextConsumer;

            toRemove = next;
          } while (toRemove);
        }
      } else {
        // Prune everything (no dependencies were accessed)
        let toRemove = node.dependencies;
        if (toRemove !== undefined) {
          do {
            const next: Dependency | undefined = toRemove.nextDependency;
            const { producer, prevConsumer, nextConsumer } = toRemove;

            // Unlink from consumer chain
            if (next !== undefined) next.prevDependency = undefined;
            node.dependencies = next;

            if (nextConsumer !== undefined)
              nextConsumer.prevConsumer = prevConsumer;
            else if (isEffect) producer.scheduledTail = prevConsumer;
            else producer.subscribersTail = prevConsumer;
            if (prevConsumer !== undefined)
              prevConsumer.nextConsumer = nextConsumer;
            else if (isEffect) producer.scheduled = nextConsumer;
            else producer.subscribers = nextConsumer;

            toRemove = next;
          } while (toRemove);
        }
      }
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}