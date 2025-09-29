import { GlobalContext } from '../context';
import type { ProducerNode, ConsumerNode, ToNode, FromNode, Dependency } from '../types';

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
    const prevDependency = consumer.dependencyTail;

    // Check 1: Is tail already pointing to this producer?
    if (prevDependency !== undefined && prevDependency.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      prevDependency.version = consumer.trackingVersion;
      // Record the current producer version
      prevDependency.producerVersion = producer.version;
      return; // Already tracking
    }

    // Check 2: Is next in sequence this producer?
    const nextDependency = prevDependency
      ? prevDependency.nextDependency
      : consumer.dependencies;

    // Check if we already have this dependency
    if (nextDependency && nextDependency.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      nextDependency.version = consumer.trackingVersion;
      // Record the current producer version
      nextDependency.producerVersion = producer.version;
      consumer.dependencyTail = nextDependency;
      return; // Found and reused
    }

    // Search rest of the list for existing connection (optimization for stable graphs)
    let existingDep = nextDependency
      ? nextDependency.nextDependency
      : undefined;

    if (existingDep) {
      do {
        if (existingDep.producer === producer) {
          // Found existing dependency - update version
          existingDep.version = consumer.trackingVersion;
          // Record the current producer version
          existingDep.producerVersion = producer.version;
          // Note: We don't move it to tail to preserve order for pruning
          return; // Reused existing dependency
        }
        existingDep = existingDep.nextDependency;
      } while (existingDep);
    }

    // No existing dependency found - create new one
    const prevConsumer = producer.subscribersTail;
    const dependency: Dependency = {
      producer,
      consumer,
      prevDependency,
      prevConsumer,
      nextDependency,
      nextConsumer: undefined,
      version: consumer.trackingVersion,
      // Record the current producer version
      producerVersion: producer.version,
    };

    // Wire up consumer side
    consumer.dependencyTail = dependency;

    if (nextDependency) nextDependency.prevDependency = dependency;

    if (prevDependency) prevDependency.nextDependency = dependency;
    else consumer.dependencies = dependency;

    // Wire up producer side
    producer.subscribersTail = dependency;

    if (prevConsumer) prevConsumer.nextConsumer = dependency;
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

    do {
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
    } while (toRemove);
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
    fn: () => T,
  ): T => {
    // Increment version for this tracking cycle
    // This happens in the pull phase, not the write hot path
    node.trackingVersion++;

    // Switch tracking context first
    const prevConsumer = ctx.currentConsumer;

    node.dependencyTail = undefined; // Reset dependency tail to start fresh dependency tracking
    ctx.currentConsumer = node;

    try {
      return fn();
    } finally {
      // Restore previous tracking context
      ctx.currentConsumer = prevConsumer;
      
      let dep = node.dependencies;
      let prevValid: Dependency | undefined = undefined;
      
      if (dep) {
        // Version-based pruning: Remove dependencies with outdated versions
        // Dependencies accessed during fn() have version === node.trackingVersion
        // Older dependencies have version < node.trackingVersion and should be pruned
        do {
          const nextDep: Dependency | undefined = dep.nextDependency;

          if (dep.version < node.trackingVersion) {
            // This dependency is stale and needs to be removed
            const { producer, prevConsumer, nextConsumer } = dep;

            // Remove from consumer's dependency list
            if (prevValid) prevValid.nextDependency = nextDep;
            else node.dependencies = nextDep;

            if (nextDep) nextDep.prevDependency = prevValid;

            // Remove from producer's subscriber list
            if (nextConsumer) nextConsumer.prevConsumer = prevConsumer;
            else producer.subscribersTail = prevConsumer;

            if (prevConsumer) prevConsumer.nextConsumer = nextConsumer;
            else producer.subscribers = nextConsumer;
            // This dependency is still valid
          } else prevValid = dep;

          dep = nextDep;
        } while (dep);
      }

      node.dependencyTail = prevValid;
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}