/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ConsumerNode, ToNode } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ConsumerNode } from '../types';

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
}

const NOOP = () => {};

/**
 * Create a graph traversal helper.
 * Provides propagation without scheduling or automatic execution.
 */
export function createGraphTraversal(): GraphTraversal {
  let dependencyStack: Stack<Dependency> | undefined;

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

    outer: for (;;) {
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

          if (currentDependency !== undefined) continue outer;
        }
        break;
      }

      // Mark as pending (invalidated)
      consumerNode.status = STATUS_PENDING;

      // This is a leaf node (no subscribers) - notify the callback
      if (!('subscribers' in consumerNode && consumerNode.subscribers)) onLeaf(consumerNode);
      else {
        // Branch point: save siblings for backtracking
        const consumerSubscribers: Dependency | undefined = consumerNode.subscribers;

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
      if ((currentDependency = currentDependency.nextConsumer) !== undefined) continue;

      // Backtrack from stack when sibling chain exhausted
      while (dependencyStack) {
        currentDependency = dependencyStack.value;
        dependencyStack = dependencyStack.prev;

        if (currentDependency !== undefined) continue outer;
      }

      break;
    };
  };

  /**
   * Simple propagation that only marks nodes as invalidated.
   * Does not schedule or execute any nodes.
   */
  const propagate = (subscribers: Dependency): void =>
    traverseGraph(subscribers, NOOP);

  return {
    propagate,
    traverseGraph,
  };
}
