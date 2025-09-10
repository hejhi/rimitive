import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_DISPOSED, MASK_STATUS, STATUS_PENDING, DIRTY } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

interface StackFrame {
  node: DerivedNode;
  dep: Dependency | undefined;
  next: StackFrame | undefined;
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

  const pullUpdates = (rootNode: DerivedNode): void => {
    let stack: StackFrame | undefined = { node: rootNode, dep: undefined, next: undefined };

    while (stack) {
      const { node } = stack;
      const flags = node.flags;
      
      if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) {
        stack = stack.next;
        continue;
      }
      
      if (!node.dependencies) {
        recomputeNode(node);
        stack = stack.next;
        continue;
      }

      // Start from saved position or beginning
      let dep: Dependency | undefined = stack.dep || node.dependencies;
      
      // Check if returning from recursive pull
      if (stack.dep && dep && dep.producer.flags & DIRTY) {
        recomputeNode(node);
        stack = stack.next;
        continue;
      }
      
      // Skip the already-processed dependency if returning
      if (stack.dep && dep) dep = dep.nextDependency;
      
      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;
        
        if (pFlags & DIRTY) {
          recomputeNode(node);
          stack = stack.next;
          break;
        }
        
        if ('compute' in producer && pFlags & STATUS_PENDING) {
          stack.dep = dep;
          stack = { node: producer, dep: undefined, next: stack };
          break;
        }
        
        dep = dep.nextDependency;
      }
      
      if (!dep) {
        node.flags = flags & ~MASK_STATUS;
        stack = stack?.next;
      }
    }
  };

  return { pullUpdates };
}