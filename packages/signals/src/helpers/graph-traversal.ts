/**
 * Graph Traversal Helper
 *
 * Provides pure graph traversal without scheduling or execution.
 * Can be used as a lightweight alternative to the scheduler when
 * effects and automatic flushing are not needed.
 */

import type { Dependency, ProducerNode } from '../types';
import { CONSTANTS } from '../constants';

const { CLEAN, DIRTY, PENDING, STATE_MASK, TYPE_MASK, PRODUCER } = CONSTANTS;

// Re-export types for proper type inference
export type { Dependency, ConsumerNode, DerivedNode } from '../types';

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface GraphTraversal {
  /** Traverse computed subscribers graph, marking nodes as invalidated */
  traverseGraph: (subscribers: Dependency) => void;
}

/**
 * Create a graph traversal helper.
 * Provides propagation without scheduling or automatic execution.
 *
 * @param schedule - Optional callback invoked for each node during traversal (typically for scheduling effects)
 */
export function createGraphTraversal(
  schedule?: (scheduledDep: Dependency) => void
): GraphTraversal {
  /**
   * Traverse dependency graph depth-first, marking nodes as invalidated.
   * Calls visitor function for each leaf node (nodes without subscribers).
   * Uses alien-signals pattern: follow chains naturally, stack only at branch points.
  */
 const traverseGraph = (subscribers: Dependency): void => {
    let dep: Dependency = subscribers;
    let next: Dependency | undefined = subscribers.nextConsumer;
    let stack: Stack<Dependency | undefined> | undefined;

    traversal: for (;;) {
      const consumerNode = dep.consumer;
      const status = consumerNode.status;
      const stateStatus = status & STATE_MASK;

      processNode: if (stateStatus === CLEAN || stateStatus === DIRTY) {
        // Call schedule for this node (callback will filter by SCHEDULED flag)
        if (schedule) schedule(dep);

        // Fall through if there's no subscribers (not a producer)
        if (!(status & PRODUCER)) {
          // Mark as pending (invalidated) - no subscribers to process
          consumerNode.status = (status & TYPE_MASK) | PENDING;
          break processNode;
        }

        // At this point, we know consumerNode is a ProducerNode
        const producerNode = consumerNode as ProducerNode;

        // Get subscribers (both computeds and effects in single list)
        const subscribers = producerNode.subscribers;
        if (subscribers === undefined) {
          // Mark as pending (invalidated) - no subscribers to process
          consumerNode.status = (status & TYPE_MASK) | PENDING;
          break processNode;
        }

        // Now mark as pending (invalidated)
        consumerNode.status = (status & TYPE_MASK) | PENDING;

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

  return {
    traverseGraph,
  };
}
