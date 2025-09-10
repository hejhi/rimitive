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

  // Stack frame for iterative traversal
  interface StackFrame {
    node: DerivedNode;
    dependency: Dependency | undefined;
    afterPull: boolean;
    next: StackFrame | undefined;
  }

  const pullUpdates = (rootNode: DerivedNode): void => {
    // Initialize stack with root node
    let stack: StackFrame | undefined = {
      node: rootNode,
      dependency: undefined,
      afterPull: false,
      next: undefined,
    };

    while (stack) {
      const frame = stack;
      const node = frame.node;
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

      // Initialize dependency traversal or continue from where we left off
      if (!frame.dependency && !frame.afterPull) {
        frame.dependency = node.dependencies;
      }

      // Process dependencies
      while (frame.dependency) {
        const current = frame.dependency;
        const producer = current.producer;
        const producerFlags = producer.flags;
        
        // If we're returning from a "recursive" call
        if (frame.afterPull) {
          frame.afterPull = false;
          // Check if the pulled computed is now DIRTY
          if (producer.flags & DIRTY) {
            recomputeNode(node);
            stack = stack.next;
            break;
          }
          // Move to next dependency
          frame.dependency = current.nextDependency;
          continue;
        }
        
        // For signals: check DIRTY flag (set on write, cleared on read)
        if (producerFlags & DIRTY) {
          recomputeNode(node);
          stack = stack.next;
          break;
        }
        
        // For computeds: check version (only computeds have meaningful versions)
        if ('compute' in producer) {
          // If already computed this cycle and changed after we last computed
          if (producer.lastChangedVersion > node.lastComputedVersion) {
            recomputeNode(node);
            stack = stack.next;
            break;
          }
          
          // If PENDING, we need to pull it to know if it changed
          if (producerFlags & STATUS_PENDING) {
            // Mark that we should check this dependency after pulling
            frame.afterPull = true;
            // Push new frame for the producer
            stack = {
              node: producer,
              dependency: undefined,
              afterPull: false,
              next: stack,
            };
            break;
          }
        }

        frame.dependency = current.nextDependency;
      }
      
      // If we've processed all dependencies without needing to recompute
      if (stack && !frame.dependency && !frame.afterPull) {
        // No dependencies changed, just clear PENDING status
        node.flags = flags & ~MASK_STATUS;
        stack = stack.next;
      }
    }
  };

  return { pullUpdates };
}