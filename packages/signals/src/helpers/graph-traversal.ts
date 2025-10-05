/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency } from '../types';
import { setPending, isClean, isDirty } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ConsumerNode, DerivedNode } from '../types';

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface GraphTraversal {
  /** Traverse computed subscribers graph with custom scheduler callback for scheduled effects */
  traverseGraph: (
    subscribers: Dependency,
    schedule: (scheduledDep: Dependency) => void
  ) => void;
  /** Simple propagation that only marks nodes as invalidated (for testing/simple use cases) */
  propagate: (subscribers: Dependency) => void;
}

/**
 * Create a graph traversal helper.
 * Provides propagation without scheduling or automatic execution.
 */
export function createGraphTraversal(): GraphTraversal {
  /**
   * Traverse dependency graph depth-first, marking nodes as invalidated.
   * Calls visitor function for each leaf node (nodes without subscribers).
   * Uses alien-signals pattern: follow chains naturally, stack only at branch points.
  */
 const traverseGraph = (
   subscribers: Dependency,
   schedule: (scheduledDep: Dependency) => void
  ): void => {
    let dep: Dependency = subscribers;
    let next: Dependency | undefined = subscribers.nextConsumer;
    let stack: Stack<Dependency | undefined> | undefined;

    traversal: for (;;) {
      const consumerNode = dep.consumer;

      processNode: if (isClean(consumerNode) || isDirty(consumerNode)) {
        // Mark as pending (invalidated)
        setPending(consumerNode);

        // Fall through if there's no subscribers
        if (!('subscribers' in consumerNode)) break processNode;

        // Schedule any effects attached to this producer
        const scheduledDep = consumerNode.scheduled;
        const subscribers = consumerNode.subscribers;

        if (scheduledDep) schedule(scheduledDep);
        if (subscribers === undefined) break processNode;

        // Continue traversal - branch node
        dep = subscribers;
        const nextSub = dep.nextConsumer;

        if (nextSub === undefined) continue traversal;

        stack = { value: next, prev: stack };
        next = nextSub;
        continue traversal;
      }

      // Advance to next sibling (unified advancement point)
      if (next !== undefined) {
        dep = next;
        next = dep.nextConsumer;
        continue traversal;
      }

      if (stack === undefined) return;

      // Unwind stack
      do {
        dep = stack.value!;
        stack = stack.prev;
        if (dep !== undefined) {
          next = dep.nextConsumer;
          continue traversal;
        }
      } while (stack);

      return;
    }
  };

  /**
   * Simple propagation that only marks nodes as invalidated.
   * Does not schedule or execute any nodes.
   */
  const NOOP = () => {};
  const propagate = (subscribers: Dependency): void => traverseGraph(subscribers, NOOP);

  return {
    traverseGraph,
    propagate,
  };
}
