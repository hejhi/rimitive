import { GlobalContext } from '../context';
import type { ProducerNode, ConsumerNode, ToNode, FromNode, Dependency } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { ProducerNode, ConsumerNode, Dependency } from '../types';

const { STATUS_CLEAN } = CONSTANTS;

export interface GraphEdges {
  trackDependency: (
    producer: ProducerNode,
    consumer: ConsumerNode,
  ) => void;
  detachAll: (dependency: Dependency) => void;
  track: <T>(
    ctx: GlobalContext,
    node: ConsumerNode,
    fn: () => T
  ) => T;
}

export function createGraphEdges(): GraphEdges {
  const trackDependency = (producer: FromNode, consumer: ToNode): void => {
    const tail = consumer.dependencyTail;

    // Fast path: already at this producer
    if (tail && tail.producer === producer) return;

    // Check next in sequence (common case during re-execution)
    const next = tail ? tail.nextDependency : consumer.dependencies;
    if (next && next.producer === producer) {
      consumer.dependencyTail = next;
      return;
    }

    // Create new dependency edge
    const producerTail = producer.subscribersTail;
    const dependency: Dependency = {
      producer,
      consumer,
      prevDependency: tail,
      prevConsumer: producerTail,
      nextDependency: next,
      nextConsumer: undefined,
    };

    // Wire up consumer side
    consumer.dependencyTail = dependency;
    if (next) next.prevDependency = dependency;
    if (tail) tail.nextDependency = dependency;
    else consumer.dependencies = dependency;

    // Wire up producer side
    producer.subscribersTail = dependency;
    if (producerTail) producerTail.nextConsumer = dependency;
    else producer.subscribers = dependency;
  };

  /**
   * Detach all dependencies from a consumer node.
   * Used during disposal to completely disconnect a node from the graph.
   *
   * @param node - The consumer node to detach
   */
  const detachAll = (dep: Dependency): void => {
    let toRemove: Dependency | undefined = dep;

    while (toRemove) {
      const {
        producer,
        consumer,
        prevDependency,
        prevConsumer,
        nextConsumer,
      } = toRemove;

      const nextDependency: Dependency | undefined = toRemove.nextDependency;

      // Update consumer's dependency chain
      if (nextDependency) nextDependency.prevDependency = prevDependency;
      else consumer.dependencyTail = prevDependency;

      if (prevDependency) prevDependency.nextDependency = nextDependency;
      else consumer.dependencies = nextDependency;

      // Update producer's dependent chain
      if (nextConsumer) nextConsumer.prevConsumer = prevConsumer;
      else producer.subscribersTail = prevConsumer;

      if (prevConsumer) prevConsumer.nextConsumer = nextConsumer;
      else producer.subscribers = nextConsumer;

      toRemove = nextDependency;
    }
  };

  /**
   * Track dependencies while executing a function.
   * This is the primary API for dependency tracking - it ensures proper
   * setup and cleanup even if the function throws.
   *
   * @param ctx - The global context
   * @param node - The consumer node that will track dependencies
   * @param fn - The function to execute while tracking
   * @returns The result of the function
   */
  const track = <T>(
    ctx: GlobalContext,
    node: ConsumerNode,
    fn: () => T
  ): T => {
    // Switch tracking context first
    const prevConsumer = ctx.currentConsumer;

    node.dependencyTail = undefined; // Reset dependency tail to start fresh dependency tracking

    // Clear status - node is being updated now
    node.status = STATUS_CLEAN;

    ctx.currentConsumer = node;

    try {
      return fn();
    } finally {
      // Restore previous tracking context
      ctx.currentConsumer = prevConsumer;

      // Prune stale dependencies. Although we set node.dependencyTail to undefined above, fn()
      // may have set it again, and we should use it if so.
      // Everything after the tail is stale and needs to be removed
      const tail = node.dependencyTail as Dependency | undefined;
      let toRemove = tail ? tail.nextDependency : node.dependencies;

      // Remove all stale dependencies efficiently using return value
      if (toRemove) detachAll(toRemove);

      node.deferredParent = undefined; // Clear deferredParent since we're recomputing
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}