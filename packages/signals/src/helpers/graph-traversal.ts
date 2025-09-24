/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ConsumerNode } from '../types';
import { CONSTANTS } from '../constants';
import { getDependencyStackPool } from './stack-pool';

// Re-export types for proper type inference
export type { Dependency, ConsumerNode } from '../types';

const { STATUS_CLEAN, STATUS_DIRTY, STATUS_PENDING } = CONSTANTS;

export interface GraphTraversal {
  /** Propagate invalidation through the dependency graph */
  propagate: (subscribers: Dependency) => void;
  /** Traverse graph with custom visitor for leaf nodes */
  traverseGraph: (subscribers: Dependency, onLeaf: (node: ConsumerNode) => void) => void;
}

const NOOP = () => { };

/**
 * Create a graph traversal helper.
 * Provides propagation without scheduling or automatic execution.
 */
export function createGraphTraversal(): GraphTraversal {
  /**
   * Traverse dependency graph depth-first, marking nodes as invalidated.
   * Calls visitor function for each leaf node (nodes without subscribers).
   *
   * OPTIMIZATION: Uses pre-allocated stack pool to avoid heap allocations.
   */
  const traverseGraph = (
    subscribers: Dependency,
    onLeaf: (node: ConsumerNode) => void
  ): void => {
    const stack = getDependencyStackPool<Dependency>();
    let currentDependency: Dependency | undefined = subscribers;

    try {
      do {
        const consumerNode = currentDependency.consumer;
        const consumerNodeStatus = consumerNode.status;

        // Skip already processed nodes
        if (consumerNodeStatus !== STATUS_CLEAN && consumerNodeStatus !== STATUS_DIRTY) {
          currentDependency = currentDependency.nextConsumer;
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
          if (!currentDependency && !stack.isEmpty()) {
            currentDependency = stack.pop();
          }
          continue;
        }

        // Continue traversal
        const consumerSubscribers = consumerNode.subscribers;
        const siblingDep = currentDependency.nextConsumer;

        if (siblingDep) {
          stack.push(siblingDep);
        }

        currentDependency = consumerSubscribers;
      } while (currentDependency);
    } finally {
      // Always clear the stack when done to release references
      stack.clear();
    }
  };

  /**
   * Simple propagation that only marks nodes as invalidated.
   * Does not schedule or execute any nodes.
   */
  const propagate = (subscribers: Dependency): void => traverseGraph(subscribers, NOOP);

  return {
    propagate,
    traverseGraph
  };
}