import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode, ScheduledNode, StatefulNode, ProducerNode } from '../types';
import type { SignalContext } from '../context';
import type { ScheduledConsumerHelpers } from './scheduled-consumer';

const { NOTIFIED, DISPOSED, RUNNING } = CONSTANTS;

// Stack frame for depth-first traversal
interface TraversalFrame {
  edge: Edge;
  next: TraversalFrame | undefined;
}

export interface GraphTraversalHelpers {
  traverseAndInvalidate: (startEdge: Edge | undefined) => void;
}

/**
 * Creates graph traversal helpers for efficient dependency graph updates.
 * This uses a stack-based approach similar to alien-signals for better performance
 * on deep dependency chains.
 */
export function createGraphTraversalHelpers(
  _ctx: SignalContext,
  { scheduleConsumer }: ScheduledConsumerHelpers
): GraphTraversalHelpers {
  /**
   * Performs a depth-first traversal of the dependency graph starting from the given edge,
   * invalidating all affected nodes in a single pass. This avoids the cascade of function
   * calls that would occur with recursive invalidation.
   */
  const traverseAndInvalidate = (startEdge: Edge | undefined): void => {
    if (!startEdge) return;

    let stack: TraversalFrame | undefined;
    let currentEdge: Edge | undefined = startEdge;

    // Main traversal loop - continues until all reachable nodes are processed
    while (currentEdge) {
      const target = currentEdge.target;
      
      // Type guard to check if target is a StatefulNode
      if ('_flags' in target) {
        const statefulTarget = target as ConsumerNode & StatefulNode;
        
        // Skip if already notified, disposed, or running
        if (statefulTarget._flags & (NOTIFIED | DISPOSED | RUNNING)) {
          currentEdge = currentEdge.nextTarget;
          continue;
        }
        
        // Mark as notified only - ALL nodes use lazy evaluation now
        statefulTarget._flags |= NOTIFIED;
        
        // Schedule if it's a scheduled node (effect)
        if ('_flush' in target && '_nextScheduled' in target && 'dispose' in target) {
          const scheduledTarget = target as unknown as ScheduledNode;
          scheduleConsumer(scheduledTarget);
        }
      }
      
      // Check if this node has its own targets (depth-first)
      if ('_targets' in target) {
        const targetAsProducer = target as ConsumerNode & ProducerNode;
        if (targetAsProducer._targets) {
          // Save current position if there are siblings to process later
          if (currentEdge.nextTarget) {
            stack = {
              edge: currentEdge.nextTarget,
              next: stack
            };
          }
          
          // Descend into the target's dependencies
          currentEdge = targetAsProducer._targets;
          continue;
        }
      }
      
      // No targets to descend into, move to next sibling
      currentEdge = currentEdge.nextTarget;
      
      // If no siblings, pop from stack to backtrack
      while (!currentEdge && stack) {
        currentEdge = stack.edge;
        stack = stack.next;
      }
    }
  }

  return { traverseAndInvalidate };
}