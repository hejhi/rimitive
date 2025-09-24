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

    // Check 1: Is tail already pointing to this producer?
    if (tail && tail.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      tail.version = consumer.trackingVersion;
      return; // Already tracking
    }

    // Check 2: Is next in sequence this producer?
    const next = tail ? tail.nextDependency : consumer.dependencies;
    if (next && next.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      next.version = consumer.trackingVersion;
      consumer.dependencyTail = next;
      return; // Found and reused
    }

    // Version-based tracking: Just create a new dependency
    // No need to search through all dependencies (O(n) removed!)
    // Stale dependencies will be pruned based on version mismatch in track()

    const producerTail = producer.subscribersTail;
    const dependency: Dependency = {
      producer,
      consumer,
      prevDependency: tail,
      prevConsumer: producerTail,
      nextDependency: next,
      nextConsumer: undefined,
      version: consumer.trackingVersion, // Mark with current tracking version
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
    // Increment version for this tracking cycle
    // This happens in the pull phase, not the write hot path
    node.trackingVersion++;

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

      // Version-based pruning: Remove dependencies with outdated versions
      // Dependencies accessed during fn() have version === node.trackingVersion
      // Older dependencies have version < node.trackingVersion and should be pruned
      const currentVersion = node.trackingVersion;
      let dep = node.dependencies;
      let prevValid: Dependency | undefined = undefined;

      while (dep) {
        const nextDep = dep.nextDependency;

        if (dep.version < currentVersion) {
          // This dependency is stale and needs to be removed
          const { producer, prevConsumer, nextConsumer } = dep;

          // Remove from consumer's dependency list
          if (prevValid) {
            prevValid.nextDependency = nextDep;
          } else {
            node.dependencies = nextDep;
          }
          if (nextDep) nextDep.prevDependency = prevValid;

          // Remove from producer's subscriber list
          if (nextConsumer) nextConsumer.prevConsumer = prevConsumer;
          else producer.subscribersTail = prevConsumer;

          if (prevConsumer) prevConsumer.nextConsumer = nextConsumer;
          else producer.subscribers = nextConsumer;
        } else {
          // This dependency is still valid
          prevValid = dep;
          node.dependencyTail = dep; // Update tail to last valid dependency
        }

        dep = nextDep;
      }

      // If no valid dependencies remain, clear the tail
      if (!prevValid) {
        node.dependencyTail = undefined;
      }
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}