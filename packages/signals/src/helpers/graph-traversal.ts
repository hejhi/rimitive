/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ConsumerNode, DerivedNode } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ConsumerNode, DerivedNode } from '../types';

const { STATUS_CLEAN, STATUS_DIRTY, STATUS_PENDING } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface GraphTraversal {
  /** Propagate invalidation through the dependency graph */
  propagate: (subscribers: Dependency) => void;
  /** Traverse graph with custom visitor for leaf nodes */
  traverseGraph: (
    subscribers: Dependency,
    onLeaf: (node: ConsumerNode) => void
  ) => void;
  /** Build recomputation queue for pull propagation */
  buildRecomputationQueue: (subscribers: Dependency) => DerivedNode[];
}

const NOOP = () => {};

/**
 * Create a graph traversal helper.
 * Provides propagation without scheduling or automatic execution.
 */
export function createGraphTraversal(): GraphTraversal {
  // Global recomputation queue for pull-propagator
  let recomputationQueue: DerivedNode[] = [];

  /**
   * Traverse dependency graph depth-first, marking nodes as invalidated.
   * Calls visitor function for each leaf node (nodes without subscribers).
   * Uses alien-signals pattern: follow chains naturally, stack only at branch points.
  */
 const traverseGraph = (
   subscribers: Dependency,
   onLeaf: (node: ConsumerNode) => void
  ): void => {
    let stack: Stack<Dependency> | undefined; // LOCAL variable (not shared)
    let currentDependency: Dependency | undefined = subscribers;

    do {
      const consumerNode = currentDependency.consumer;
      const consumerNodeStatus = consumerNode.status;

      // Skip already processed nodes
      if (consumerNodeStatus !== STATUS_CLEAN && consumerNodeStatus !== STATUS_DIRTY) {
        currentDependency = currentDependency.nextConsumer;
        if (!currentDependency && stack) {
          currentDependency = stack.value;
          stack = stack.prev;
        }
        continue;
      }

      // Mark as pending (invalidated)
      consumerNode.status = STATUS_PENDING;

      // Check if we can traverse deeper
      const hasSubscribers = 'subscribers' in consumerNode && consumerNode.subscribers;

      if (!hasSubscribers) {
        // This is a leaf node - notify the callback
        onLeaf(consumerNode);

        currentDependency = currentDependency.nextConsumer;
        if (!currentDependency && stack) {
          currentDependency = stack.value;
          stack = stack.prev;
        }
        continue;
      }

      // Continue traversal - branch node
      const consumerSubscribers = consumerNode.subscribers;
      const siblingDep = currentDependency.nextConsumer;

      if (siblingDep) {
        // Push sibling onto stack (inline allocation)
        stack = { value: siblingDep, prev: stack };
      }

      currentDependency = consumerSubscribers;
    } while (currentDependency);
  };

  /**
   * Simple propagation that only marks nodes as invalidated.
   * Does not schedule or execute any nodes.
   */
  const propagate = (subscribers: Dependency): void =>
    traverseGraph(subscribers, NOOP);

  /**
   * Build recomputation queue by traversing dependency graph.
   * Queue contains derived nodes in topological order for pull propagation.
   */
  const buildRecomputationQueue = (subscribers: Dependency): DerivedNode[] => {
    recomputationQueue.length = 0; // Clear queue
    traverseGraph(subscribers, (node: ConsumerNode) => {
      // Only add derived nodes (computeds) to the queue
      if ('compute' in node) {
        recomputationQueue.push(node as DerivedNode);
      }
    });
    return recomputationQueue.slice(); // Return copy to avoid mutation
  };

  return {
    propagate,
    traverseGraph,
    buildRecomputationQueue,
  };
}
