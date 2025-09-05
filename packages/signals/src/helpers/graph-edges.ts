import { CONSTANTS } from '../constants';
import { GlobalContext } from '../context';
import type { ProducerNode, ConsumerNode, ToNode, FromNode, Dependency } from '../types';

export interface GraphEdges {
  trackDependency: (
    producer: ProducerNode,
    consumer: ConsumerNode,
    version: number
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

const { STATUS_CLEAN, STATUS_PENDING, MASK_STATUS } = CONSTANTS;

export function createGraphEdges(): GraphEdges {
  const trackDependency = (
    producer: FromNode,
    consumer: ToNode,
    version: number
  ): void => {
    const tail = consumer.dependencyTail;

    // Fast path: already at this producer
    if (tail && tail.producer === producer) return;

    // Check next in sequence (common case during re-execution)
    const next = tail ? tail.nextDependency : consumer.dependencies;
    if (next && next.producer === producer) {
      next.version = version;
      consumer.dependencyTail = next;
      return;
    }

    const producerTail = producer.dependentsTail;
    const dependency: Dependency = {
      producer,
      consumer,
      version,
      prevDependency: tail,
      prevDependent: producerTail,
      nextDependency: next,
      nextDependent: undefined,
    };

    // Wire up consumer side
    consumer.dependencyTail = dependency;
    if (next) next.prevDependency = dependency;
    if (tail) tail.nextDependency = dependency;
    else consumer.dependencies = dependency;

    // Wire up producer side
    producer.dependentsTail = dependency;
    if (producerTail) producerTail.nextDependent = dependency;
    else producer.dependents = dependency;
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

    // Only increment version for top-level tracking (no parent consumer)
    ctx.trackingVersion++;

    // Reset dependency tail to start fresh dependency tracking
    node.dependencyTail = undefined;

    // Batch operation: clear multiple status bits at once
    node.flags = node.flags & ~(STATUS_PENDING);

    ctx.currentConsumer = node;
    return prevConsumer;
  };

  // Helper to remove a dependency edge (inlined from graph-edges logic)
  const removeDependency = ({
    producer,
    consumer,
    prevDependency,
    nextDependency,
    prevDependent,
    nextDependent,
  }: Dependency): Dependency | undefined => {
    if (nextDependency) nextDependency.prevDependency = prevDependency;
    else consumer.dependencyTail = prevDependency;

    if (prevDependency) prevDependency.nextDependency = nextDependency;
    else consumer.dependencies = nextDependency;

    if (nextDependent) nextDependent.prevDependent = prevDependent;
    else producer.dependentsTail = prevDependent;

    if (prevDependent) prevDependent.nextDependent = nextDependent;
    else producer.dependents = nextDependent;

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

    // Remove all stale dependencies
    while (toRemove) {
      const next = toRemove.nextDependency;
      removeDependency(toRemove);
      toRemove = next;
    }

    // Batch operation: set clean status directly
    node.flags = (node.flags & ~MASK_STATUS) | STATUS_CLEAN;
  };

  /**
   * Detach all dependencies from a consumer node.
   * Used during disposal to completely disconnect a node from the graph.
   *
   * @param node - The consumer node to detach
   */
  const detachAll = (node: ConsumerNode): void => {
    let dependency = node.dependencies;

    while (dependency) {
      const next = dependency.nextDependency;
      removeDependency(dependency);
      dependency = next;
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