import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_DISPOSED, MASK_STATUS, STATUS_PENDING, DIRTY } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

export function createPullPropagator(ctx: GlobalContext & { graphEdges: GraphEdges }): PullPropagator {
  const { startTracking, endTracking } = ctx.graphEdges;

  // Inline recomputation logic here since we have access to context
  const recomputeNode = (node: DerivedNode): boolean => {
    const prevConsumer = startTracking(ctx, node);
    let valueChanged = false;

    try {
      const oldValue = node.value;
      const newValue = node.compute();

      // Update value and return whether it changed
      if (newValue !== oldValue) {
        node.value = newValue;
        node.lastChangedVersion = ctx.trackingVersion;
        valueChanged = true;
      }
    } finally {
      // Mark as computed in this tracking cycle
      node.lastComputedVersion = ctx.trackingVersion;
      
      // End tracking, restore context, and prune stale dependencies
      endTracking(ctx, node, prevConsumer);
    }
    
    // Set DIRTY property if changed, clear if not changed
    if (valueChanged) {
      node.flags = (node.flags & ~MASK_STATUS) | DIRTY;
    } else {
      // Clear both status AND DIRTY flag when value doesn't change
      node.flags = node.flags & ~(MASK_STATUS | DIRTY);
    }
    
    return valueChanged;
  };

  // Minimal stack frame with only 2 data properties
  interface StackFrame {
    node: DerivedNode;
    checkDep: Dependency | undefined; // Dep to check after pull, or undefined to start fresh
    next: StackFrame | undefined;
  }

  const pullUpdates = (rootNode: DerivedNode): void => {
    // Initialize stack with root node
    let stack: StackFrame | undefined = {
      node: rootNode,
      checkDep: undefined,
      next: undefined,
    };

    while (stack) {
      const node = stack.node;
      const flags = node.flags;
      
      // Fast path: disposed or already clean
      if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) {
        stack = stack.next;
        continue;
      }
      
      // If no dependencies yet (first run), must recompute
      if (!node.dependencies) {
        recomputeNode(node);
        stack = stack.next;
        continue;
      }

      // If returning from a pull, check if the dependency changed
      if (stack.checkDep) {
        const checkProducer = stack.checkDep.producer;
        if (checkProducer.flags & DIRTY) {
          recomputeNode(node);
          stack = stack.next;
          continue;
        }
        // Continue checking from next dependency
        let current = stack.checkDep.nextDependency;
        stack.checkDep = undefined; // Clear the check flag
        
        // Continue traversing remaining dependencies
        while (current) {
          const producer = current.producer;
          const producerFlags = producer.flags;
          
          // For signals: check DIRTY flag
          if (producerFlags & DIRTY) {
            recomputeNode(node);
            stack = stack.next;
            break;
          }
          
          // For computeds: check version
          if ('compute' in producer) {
            if (producer.lastChangedVersion > node.lastComputedVersion) {
              recomputeNode(node);
              stack = stack.next;
              break;
            }
            
            // If PENDING, push it for processing
            if (producerFlags & STATUS_PENDING) {
              // Store which dependency to check when we return
              stack.checkDep = current;
              // Push new frame for the producer
              stack = {
                node: producer,
                checkDep: undefined,
                next: stack,
              };
              break;
            }
          }
          
          current = current.nextDependency;
        }
        
        // If we broke out of the loop, continue the outer while
        if (current) continue;
      } else {
        // First time checking this node's dependencies
        let current = node.dependencies;
        
        while (current) {
          const producer = current.producer;
          const producerFlags = producer.flags;
          
          // For signals: check DIRTY flag
          if (producerFlags & DIRTY) {
            recomputeNode(node);
            stack = stack.next;
            break;
          }
          
          // For computeds: check version
          if ('compute' in producer) {
            if (producer.lastChangedVersion > node.lastComputedVersion) {
              recomputeNode(node);
              stack = stack.next;
              break;
            }
            
            // If PENDING, push it for processing
            if (producerFlags & STATUS_PENDING) {
              // Store which dependency to check when we return
              stack.checkDep = current;
              // Push new frame for the producer
              stack = {
                node: producer,
                checkDep: undefined,
                next: stack,
              };
              break;
            }
          }
          
          current = current.nextDependency;
        }
        
        // If we broke out of the loop, continue the outer while
        if (current) continue;
      }
      
      // No dependencies changed, just clear PENDING status
      node.flags = flags & ~MASK_STATUS;
      stack = stack.next;
    }
  };

  return { pullUpdates };
}