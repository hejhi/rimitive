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

    traversal: do {
      const node = stack.node;
      const flags = node.flags;

      stack = stack.next;

      // Skip disposed or already-processed nodes
      if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) continue;

      // No dependencies - just recompute
      if (!node.dependencies) {
        recomputeNode(node);
        continue;
      }

      // Check all dependencies: defer PENDING computeds, track if any are DIRTY
      let dep: Dependency | undefined = node.dependencies;
      let hasDirty = false;
      
      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;
        
        // If dependency is a pending computed, we need to process it first
        if ('compute' in producer && pFlags & STATUS_PENDING) {
          // Add the dependency to process immediately, then the current node
          stack = { node: producer, next: { node, next: stack } };
          continue traversal; // Process the dependency first
        }
        
        // Track if any dependency is dirty (we'll use this after checking all)
        if (pFlags & DIRTY) {
          hasDirty = true;
        }
        
        dep = dep.nextDependency;
      }
      
      // If we got here, all computed dependencies have been processed
      if (hasDirty) {
        recomputeNode(node);
        continue traversal; // Done with this node
      }

      // No dependencies were dirty, clear flags
      node.flags = flags & ~(MASK_STATUS | DIRTY); // Node is clean - clear flags immediately
    } while (stack)
  };

  return { pullUpdates };
}