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

type Visit = (dep: Dependency) => void;

export interface GraphTraversal {
  /** Traverse computed subscribers graph, marking nodes as invalidated */
  propagate: (consumers: Dependency) => void;
  withVisitor: (visit: Visit | null) => (consumers: Dependency) => void;
}

/**
 * Create a graph traversal helper.
 * Provides propagation without scheduling or automatic execution.
 *
 * @param schedule - Optional callback invoked for each node during traversal (typically for scheduling effects)
 */
export function createGraphTraversal(): GraphTraversal {
  /**
   * Traverse dependency graph depth-first, marking nodes as invalidated.
   * Calls visitor function for each leaf node (nodes without subscribers).
   * Uses alien-signals pattern: follow chains naturally, stack only at branch points.
  */
 const withVisitor =
   (visit: Visit | null = null) =>
   (consumers: Dependency): void => {
     let dep: Dependency = consumers;
     let next: Dependency | undefined = consumers.nextConsumer;
     let stack: Stack<Dependency | undefined> | undefined;

     traversal: for (;;) {
       const consumerNode = dep.consumer;
       const status = consumerNode.status;
       const stateStatus = status & STATE_MASK;

       depTraversal: if (stateStatus === CLEAN || stateStatus === DIRTY) {
         if (visit) visit(dep);

         // Mark as pending (invalidated) - no subscribers to process
         consumerNode.status = (consumerNode.status & TYPE_MASK) | PENDING;

         // Fall through if there's no subscribers (not a producer)
         if (!(status & PRODUCER)) break depTraversal;

         // At this point, we know consumerNode is a ProducerNode
         const producerNode = consumerNode as ProducerNode;

         // Get subscribers (both computeds and effects in single list)
         const subscribers = producerNode.subscribers;
         if (subscribers === undefined) break depTraversal;

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
    withVisitor: withVisitor,
    propagate: withVisitor(null),
  };
}
