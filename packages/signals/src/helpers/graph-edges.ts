import { GlobalContext } from '../context';
import type { ProducerNode, ConsumerNode, ToNode, FromNode, Dependency } from '../types';
import { CONSTANTS } from '../constants';

const { TYPE_MASK, CLEAN } = CONSTANTS;

// Re-export types for proper type inference
export type { ProducerNode, ConsumerNode, Dependency } from '../types';

export interface GraphEdges {
  trackDependency: (
    producer: ProducerNode,
    consumer: ConsumerNode,
  ) => void;
  detachAll: (dependency: Dependency) => void;
  track: <T>(
    node: ConsumerNode,
    fn: () => T,
  ) => T;
}

export function createGraphEdges({ ctx }: { ctx: GlobalContext }): GraphEdges {
  // Helper to unlink a dependency from producer's consumer list
  const unlinkFromProducer = (
    producer: ProducerNode,
    prevConsumer: Dependency | undefined,
    nextConsumer: Dependency | undefined
  ): void => {
    if (nextConsumer !== undefined)
      nextConsumer.prevConsumer = prevConsumer;
    else producer.subscribersTail = prevConsumer;

    if (prevConsumer !== undefined)
      prevConsumer.nextConsumer = nextConsumer;
    else producer.subscribers = nextConsumer;
  };

  const trackDependency = (
    producer: FromNode,
    consumer: ToNode
  ): void => {
    const tail = consumer.dependencyTail;

    // Fast path: tail already points to this producer
    if (tail !== undefined && tail.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      tail.version = ctx.trackingVersion;
      return; // Already tracking
    }

    // Check next dependency in sequence
    const next = tail ? tail.nextDependency : consumer.dependencies;
    if (next !== undefined && next.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      next.version = ctx.trackingVersion;
      consumer.dependencyTail = next;
      return; // Found and reused
    }

    // Get tail of producer's subscriber list for O(1) append
    const prevConsumer = producer.subscribersTail;

    // Create new dependency edge
    const dep: Dependency = {
      producer,
      consumer,
      prevDependency: tail,
      prevConsumer,
      nextDependency: next,
      nextConsumer: undefined,
      version: ctx.trackingVersion,
    };

    // Wire consumer side
    consumer.dependencyTail = dep;
    if (next) next.prevDependency = dep;
    if (tail) tail.nextDependency = dep;
    else consumer.dependencies = dep;

    // Wire producer side - single subscriber list for all consumers
    if (prevConsumer) prevConsumer.nextConsumer = dep;
    producer.subscribersTail = dep;
    if (!prevConsumer) producer.subscribers = dep;
  };

  /**
   * Detach all dependencies from a consumer node.
   * Used during disposal to completely disconnect a node from the graph.
   */
  const detachAll = (dep: Dependency): void => {
    // All dependencies in the chain share the same consumer
    const consumer = dep.consumer;
    let current: Dependency | undefined = dep;

    do {
      const next: Dependency | undefined = current.nextDependency;
      const { producer, prevDependency, prevConsumer, nextConsumer } = current;

      // Unlink from consumer chain
      if (next) next.prevDependency = prevDependency;
      else consumer.dependencyTail = prevDependency;

      if (prevDependency) prevDependency.nextDependency = next;
      else consumer.dependencies = next;

      // Unlink from producer chain
      unlinkFromProducer(producer, prevConsumer, nextConsumer);

      current = next;
    } while (current);
  };

  const track = <T>(node: ConsumerNode, fn: () => T): T => {
    ctx.trackingVersion++;

    // Clear dirty and pending flags before tracking
    node.status = (node.status & TYPE_MASK) | CLEAN;

    const prevConsumer = ctx.consumerScope;
    node.dependencyTail = undefined;
    ctx.consumerScope = node;

    try {
      return fn();
    } finally {
      // Record when this node was last tracked (for staleness detection)
      node.trackingVersion = ctx.trackingVersion;
      ctx.consumerScope = prevConsumer;

      // Prune stale dependencies (everything after dependencyTail)
      // dependencyTail marks the last dependency accessed in this tracking cycle
      // Anything after it is stale and should be removed
      const tail = node.dependencyTail as Dependency | undefined;

      // Start point for pruning
      let toRemove = tail ? tail.nextDependency : node.dependencies;

      if (toRemove !== undefined) {
        do {
          const next: Dependency | undefined = toRemove.nextDependency;
          const { producer, prevConsumer, nextConsumer } = toRemove;

          // Unlink from consumer chain
          if (next !== undefined) next.prevDependency = tail;
          if (tail) tail.nextDependency = next;
          else node.dependencies = next;

          // Unlink from producer chain
          unlinkFromProducer(producer, prevConsumer, nextConsumer);

          toRemove = next;
        } while (toRemove);
      }
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}