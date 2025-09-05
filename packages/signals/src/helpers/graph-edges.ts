import { CONSTANTS, createFlagManager } from '../constants';
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

const { STATUS_CLEAN, STATUS_DIRTY, STATUS_PENDING } = CONSTANTS;
const { setStatus } = createFlagManager();

export function createGraphEdges(): GraphEdges {
  const trackDependency = (
    producer: FromNode,
    consumer: ToNode,
    version: number
  ): void => {
    const tail = consumer.dependencyTail;

    if (tail && tail.producer === producer) return;

    // Tail will be undefined until after the first dependency in the executing consumer is read.
    // In that case, we should go with the first Dependency in the existing list.
    const candidate = tail ? tail.nextDependency : consumer.dependencies;

    if (candidate && candidate.producer === producer) {
      candidate.version = version; // Update version when reusing dependency
      consumer.dependencyTail = candidate;
      return;
    }

    const prevDependent = producer.dependentsTail;

    const newDependency = {
      producer: producer,
      consumer: consumer,
      version: version, // Use passed version instead of placeholder 0
      prevDependency: tail,
      prevDependent,
      nextDependency: candidate,
      nextDependent: undefined,
    };

    if (candidate) candidate.prevDependency = newDependency;
    if (tail) tail.nextDependency = newDependency;
    else consumer.dependencies = newDependency;

    consumer.dependencyTail = newDependency;

    if (prevDependent) prevDependent.nextDependent = newDependency;
    else producer.dependents = newDependency;

    producer.dependentsTail = newDependency;
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

    const flags = node.flags;
    node.flags = flags & ~(STATUS_DIRTY | STATUS_PENDING);

    ctx.currentConsumer = node;
    return prevConsumer;
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

    // Prune stale dependencies (like alien-signals)
    // Everything after the tail is stale and needs to be removed
    const tail = node.dependencyTail;
    let toRemove = tail ? tail.nextDependency : node.dependencies;

    // Remove all stale dependencies
    while (toRemove) {
      const next = toRemove.nextDependency;
      removeDependency(toRemove);
      toRemove = next;
    }

    // Set the node back to a clean state after tracking
    const flags = node.flags;
    node.flags = setStatus(flags, STATUS_CLEAN);
  };

  // Helper to remove a dependency edge (inlined from graph-edges logic)
  const removeDependency = (dependency: Dependency): Dependency | undefined => {
    const {
      producer,
      consumer,
      prevDependency,
      nextDependency,
      prevDependent,
      nextDependent,
    } = dependency;

    if (nextDependency) nextDependency.prevDependency = prevDependency;
    else consumer.dependencyTail = prevDependency;

    if (prevDependency) prevDependency.nextDependency = nextDependency;
    else consumer.dependencies = nextDependency;

    if (nextDependent) nextDependent.prevDependent = prevDependent;
    else producer.dependentsTail = prevDependent;

    if (prevDependent) prevDependent.nextDependent = nextDependent;
    else producer.dependents = nextDependent;
    
    return nextDependency;  // Return next for efficient iteration
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
    detachAll
  };
}