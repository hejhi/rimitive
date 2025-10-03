/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ConsumerNode } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ConsumerNode, DerivedNode } from '../types';

const { STATUS_CLEAN, DERIVED_DIRTY, CONSUMER_PENDING } = CONSTANTS;

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

const NOOP = () => { };

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
   schedule: (node: ConsumerNode) => void
  ): void => {
    // Early exit for undefined/null subscribers
    if (!subscribers) return;

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
        if ('subscribers' in consumerNode) {
          const subscribers = consumerNode.subscribers;
          let scheduledDep = consumerNode.scheduled;

          if (scheduledDep) {
            while (scheduledDep) {
              const scheduled = scheduledDep.consumer;
              if (scheduled.status === STATUS_CLEAN) {
                scheduled.status = CONSUMER_PENDING;
                schedule(scheduled);
              }
              scheduledDep = scheduledDep.nextConsumer;
            }
          }

          // Check if we can traverse deeper
          if (subscribers) {
            // Continue traversal - branch node
            dep = subscribers;
            const nextSub = dep.nextConsumer;
            if (nextSub !== undefined) {
              stack = { value: next, prev: stack };
              next = nextSub;
            }
            continue;
          }
        }

        // This is a leaf node - notify the callback
        schedule(consumerNode);
      }

      // Advance to next sibling (unified advancement point)
      if (next !== undefined) {
        dep = next;
        next = dep.nextConsumer;
        continue;
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
