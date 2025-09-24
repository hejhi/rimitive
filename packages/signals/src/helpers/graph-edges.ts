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
      return; // Already tracking
    }

    // Check 2: Is next in sequence this producer?
    const next = tail ? tail.nextDependency : consumer.dependencies;
    if (next && next.producer === producer) {
      consumer.dependencyTail = next;
      return; // Found and reused
    }

    // Check 3: Search all existing dependencies
    // If we find one out of order, we need to move it to the correct position
    let dep = consumer.dependencies;
    while (dep) {
      if (dep.producer === producer) {
        // Found existing dependency, but it's out of order
        // We need to move it to the position after the current tail

        // First, unlink it from its current position
        const depPrev = dep.prevDependency;
        const depNext = dep.nextDependency;

        if (depPrev) {
          depPrev.nextDependency = depNext;
        } else {
          consumer.dependencies = depNext;
        }

        if (depNext) {
          depNext.prevDependency = depPrev;
        }

        // If this was the tail, we don't update it yet
        // as we're about to move this node

        // Now re-insert it after the current tail
        dep.prevDependency = tail;
        dep.nextDependency = tail ? tail.nextDependency : consumer.dependencies;

        if (tail) {
          if (tail.nextDependency) tail.nextDependency.prevDependency = dep;
          tail.nextDependency = dep;
        } else {
          // No tail means this becomes the first dependency
          if (consumer.dependencies) consumer.dependencies.prevDependency = dep;
          consumer.dependencies = dep;
        }

        // Update the tail to point to this reordered dependency
        consumer.dependencyTail = dep;
        return;
      }
      dep = dep.nextDependency;
    }

    // Only create new dependency if not found
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
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}