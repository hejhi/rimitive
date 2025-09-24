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

    // Check 3: CRITICAL NEW CODE - Search all existing dependencies
    // Start from the beginning of the dependency list and search all dependencies
    let dep = consumer.dependencies;
    while (dep) {
      if (dep.producer === producer) {
        consumer.dependencyTail = dep;
        return; // Found existing edge, reuse it
      }
      dep = dep.nextDependency;
    }

    // Only NOW create new dependency if not found
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

    // Mark all existing dependencies as potentially stale
    let dep = node.dependencies;
    while (dep) {
      // Use a marker to track which dependencies are still active
      // We'll repurpose nextDependency temporarily as a marker
      (dep as any).__stale = true;
      dep = dep.nextDependency;
    }

    node.dependencyTail = undefined; // Reset dependency tail to start fresh dependency tracking

    // Clear status - node is being updated now
    node.status = STATUS_CLEAN;

    ctx.currentConsumer = node;

    try {
      return fn();
    } finally {
      // Restore previous tracking context
      ctx.currentConsumer = prevConsumer;

      // Now prune any dependencies that weren't re-accessed (still marked as stale)
      let prev: Dependency | undefined = undefined;
      let current = node.dependencies;

      while (current) {
        const next = current.nextDependency;

        if ((current as any).__stale) {
          // This dependency wasn't re-accessed, remove it
          if (prev) {
            prev.nextDependency = next;
          } else {
            node.dependencies = next;
          }

          if (next) {
            next.prevDependency = prev;
          } else {
            node.dependencyTail = prev;
          }

          // Remove from producer's subscriber list
          const { producer, prevConsumer, nextConsumer } = current;
          if (nextConsumer) {
            nextConsumer.prevConsumer = prevConsumer;
          } else {
            producer.subscribersTail = prevConsumer;
          }
          if (prevConsumer) {
            prevConsumer.nextConsumer = nextConsumer;
          } else {
            producer.subscribers = nextConsumer;
          }
        } else {
          // This dependency is still active, keep it
          delete (current as any).__stale;
          prev = current;
        }

        current = next;
      }
    }
  };

  return {
    trackDependency,
    detachAll,
    track,
  };
}