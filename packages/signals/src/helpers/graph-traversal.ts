/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ConsumerNode, DerivedNode } from '../types';

const { STATUS_CLEAN, DERIVED_DIRTY, CONSUMER_PENDING } = CONSTANTS;

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
    // Check if this is a scheduled effects chain (effects don't have 'subscribers')
    // If so, pass directly to scheduler and return - no need to traverse

    let dep: Dependency = subscribers;
    let next: Dependency | undefined = subscribers.nextConsumer;
    let stack: Stack<Dependency | undefined> | undefined;

    traverse: for (;;) {
      const consumerNode = dep.consumer;
      const status = consumerNode.status;

      if (status === STATUS_CLEAN || status === DERIVED_DIRTY) {
        // Mark as pending (invalidated)
        consumerNode.status = CONSUMER_PENDING;

        // Handle producers
        deeper: if ('subscribers' in consumerNode) {
          // Schedule any effects attached to this producer
          const scheduledDep = consumerNode.scheduled;
          if (scheduledDep) schedule(scheduledDep);

          const subscribers = consumerNode.subscribers;
          if (subscribers === undefined) break deeper; // Fallthrough

          // Continue traversal - branch node
          dep = subscribers;
          const nextSub = dep.nextConsumer;

          if (nextSub === undefined) continue traverse;

          stack = { value: next, prev: stack };
          next = nextSub;
          continue traverse;
        }
      }

      // Advance to next sibling (unified advancement point)
      if (next !== undefined) {
        dep = next;
        next = dep.nextConsumer;
        continue traverse;
      }

      // Unwind stack
      while (stack !== undefined) {
        dep = stack.value!;
        stack = stack.prev;
        if (dep !== undefined) {
          next = dep.nextConsumer;
          continue traverse;
        }
      }

      break traverse;
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
