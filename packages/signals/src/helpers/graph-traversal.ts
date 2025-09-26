/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ConsumerNode, ToNode, DerivedNode } from '../types';
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
  let dependencyStack: Stack<Dependency> | undefined;
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
    let currentDependency: Dependency | undefined = subscribers;

    traversal: for (;;) {
      const consumerNode: ToNode = currentDependency.consumer;
      const consumerNodeStatus = consumerNode.status;

      // Skip already processed nodes
      if (
        consumerNodeStatus !== STATUS_CLEAN &&
        consumerNodeStatus !== STATUS_DIRTY
      ) {
        // Continue with next sibling in current level
        if ((currentDependency = currentDependency.nextConsumer) !== undefined)
          continue;

        // Backtrack from stack when sibling chain exhausted
        while (dependencyStack) {
          currentDependency = dependencyStack.value;
          dependencyStack = dependencyStack.prev;

          if (currentDependency !== undefined) continue traversal;
        }
        break;
      }

      // Mark as pending (invalidated)
      consumerNode.status = STATUS_PENDING;

      // This is a leaf node (no subscribers) - notify the callback
      if (!('subscribers' in consumerNode && consumerNode.subscribers))
        onLeaf(consumerNode);
      else {
        // Branch point: save siblings for backtracking
        const consumerSubscribers: Dependency | undefined =
          consumerNode.subscribers;

        if (currentDependency === undefined) {
          // Traverse deeper into subscribers
          currentDependency = consumerSubscribers;
          continue;
        }

        const nextSibling = currentDependency.nextConsumer;

        if (nextSibling !== undefined) {
          dependencyStack = { value: nextSibling, prev: dependencyStack };
        }

        // Traverse deeper into subscribers
        currentDependency = consumerSubscribers;
        continue;
      }

      // Continue with next sibling in current level
      if ((currentDependency = currentDependency.nextConsumer) !== undefined)
        continue;

      // Backtrack from stack when sibling chain exhausted
      while (dependencyStack) {
        currentDependency = dependencyStack.value;
        dependencyStack = dependencyStack.prev;

        if (currentDependency !== undefined) continue traversal;
      }

      break;
    }
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
