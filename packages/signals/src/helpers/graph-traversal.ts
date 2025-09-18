/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ConsumerNode } from '../types';
import { CONSTANTS } from '../constants';

const { STATUS_CLEAN, STATUS_DIRTY, STATUS_PENDING } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

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
   */
  const traverseGraph = (
    subscribers: Dependency,
    onLeaf: (node: ConsumerNode) => void
  ): void => {
    let dependencyStack: Stack<Dependency> | undefined;
    let currentDependency: Dependency | undefined = subscribers;

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
        if (!currentDependency && dependencyStack) {
          currentDependency = dependencyStack.value;
          dependencyStack = dependencyStack.prev;
        }
        continue;
      }

      // Continue traversal
      const consumerSubscribers = consumerNode.subscribers!;
      const siblingDep = currentDependency.nextConsumer;

      if (siblingDep) {
        dependencyStack = { value: siblingDep, prev: dependencyStack };
      }

      currentDependency = consumerSubscribers;
    } while (currentDependency);
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