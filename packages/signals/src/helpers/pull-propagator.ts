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
        valueChanged = true;
      }
    } finally {
      // End tracking, restore context, and prune stale dependencies
      endTracking(ctx, node, prevConsumer);
    }
    
    const flags = node.flags;

    // Set DIRTY property if changed, clear if not changed
    if (valueChanged) node.flags = (flags & ~MASK_STATUS) | DIRTY;
    else node.flags = flags & ~(MASK_STATUS | DIRTY); // Clear both status AND DIRTY flag when value doesn't change

    return valueChanged;
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let stack: StackFrame | undefined = { node: rootNode, next: undefined };

    traversal: while (stack) {
      const node = stack.node;
      const flags = node.flags;

      stack = stack.next;

      // Skip disposed or non-pending nodes
      if (flags & STATUS_DISPOSED) continue;

      // No dependencies - just recompute
      if (!node.dependencies) {
        recomputeNode(node);
        continue;
      }

      // First scan: look for PENDING computed dependencies that need processing
      let dep: Dependency | undefined = node.dependencies;
      
      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;
        
        // If dependency is a pending computed, we need to process it first
        if ('compute' in producer && pFlags & STATUS_PENDING) {
          // Add the dependency to process immediately, then the current node
          stack = { node: producer, next: { node, next: stack } };
          continue traversal; // Process the dependency first
        }
        
        dep = dep.nextDependency;
      }
      
      // All computed dependencies have been processed, now check if any are dirty
      dep = node.dependencies;
      let needsUpdate = false;
      
      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;

        // If dependency is dirty (signal or computed), we need to update
        if (pFlags & DIRTY) {
          needsUpdate = true;
          break; // No need to check further dependencies
        }

        dep = dep.nextDependency;
      }

      if (needsUpdate) recomputeNode(node);
      else node.flags = flags & ~(MASK_STATUS | DIRTY); // Node is clean - clear flags immediately
    }

    rootNode.flags &= ~DIRTY;
  };

  return { pullUpdates };
}