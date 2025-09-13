import { GlobalContext } from '../context';
import type { ProducerNode, ConsumerNode, ToNode, FromNode, Dependency } from '../types';

export interface GraphEdges {
  trackDependency: (
    producer: ProducerNode,
    consumer: ConsumerNode,
  ) => void;
  startTracking: (
    ctx: GlobalContext,
    node: ConsumerNode
  ) => ConsumerNode | null;
  endTracking: (
    ctx: GlobalContext,
    node: ConsumerNode,
    prevConsumer: ConsumerNode | null
  ) => void;
  removeDependency: (dependency: Dependency) => Dependency | undefined;
  detachAll: (node: ConsumerNode) => void;
}

export function createGraphEdges(): GraphEdges {
  const trackDependency = (
    producer: FromNode,
    consumer: ToNode,
  ): void => {
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
   * Start tracking dependencies for a consumer node.
   * This prepares the node to record new dependencies.
   *
   * @param ctx - The global context
   * @param node - The consumer node starting to track dependencies
   * @returns The previous consumer (for restoration in endTracking)
   */
  const startTracking = (
    ctx: GlobalContext,
    node: ConsumerNode
  ): ConsumerNode | null => {
    // Switch tracking context first
    const prevConsumer = ctx.currentConsumer;

    node.dependencyTail = undefined; // Reset dependency tail to start fresh dependency tracking

    // Clear all flags - node is being updated now
    node.flags = 0;

    ctx.currentConsumer = node;
    return prevConsumer;
  };

  // Helper to remove a dependency edge (optimized for hot path)
  const removeDependency = (dep: Dependency): Dependency | undefined => {
    const { producer, consumer, prevDependency, nextDependency, prevConsumer, nextConsumer } = dep;
    
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

    return nextDependency; // Return next for efficient iteration
  };

  /**
   * End tracking dependencies for a consumer node.
   * This is where we clean up stale dependencies.
   *
   * @param ctx - The global context
   * @param node - The consumer node ending tracking
   * @param prevConsumer - The previous consumer to restore
   */
  const endTracking = (
    ctx: GlobalContext,
    node: ConsumerNode,
    prevConsumer: ConsumerNode | null
  ): void => {
    // Restore previous tracking context
    ctx.currentConsumer = prevConsumer;

    // Prune stale dependencies
    // Everything after the tail is stale and needs to be removed
    const tail = node.dependencyTail;
    let toRemove = tail ? tail.nextDependency : node.dependencies;

    // Remove all stale dependencies efficiently using return value
    while (toRemove) {
      toRemove = removeDependency(toRemove);
    }

    node.deferredParent = undefined; // Clear deferredParent since we're recomputing
  };

  /**
   * Detach all dependencies from a consumer node.
   * Used during disposal to completely disconnect a node from the graph.
   *
   * @param node - The consumer node to detach
   */
  const detachAll = (node: ConsumerNode): void => {
    let toRemove = node.dependencies;

    while (toRemove) {
      toRemove = removeDependency(toRemove);
    }

    node.dependencies = undefined;
    node.dependencyTail = undefined;
  };

  return {
    trackDependency,
    startTracking,
    endTracking,
    removeDependency,
    detachAll,
  };
}