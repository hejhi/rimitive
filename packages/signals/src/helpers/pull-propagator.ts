import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_PENDING, DIRTY, MASK_STATUS } = CONSTANTS;

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

    // Set DIRTY property if changed, clear if not changed
    if (valueChanged) node.flags = DIRTY;
    else node.flags = 0; // Clear both status AND DIRTY flag when value doesn't change

    return valueChanged;
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let stack: StackFrame | undefined = { node: rootNode, next: undefined };

    traversal: do {
      const node = stack.node;
      const flags = node.flags;

      stack = stack.next;

      // Skip disposed or already-processed nodes
      // Continue only if PENDING and not DISPOSED
      if ((flags & MASK_STATUS) !== STATUS_PENDING) continue;

      // No dependencies - just recompute
      if (!node.dependencies) {
        recomputeNode(node);
        continue;
      }

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
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
        
        // If dependency is dirty, recompute immediately
        if (pFlags & DIRTY) {
          recomputeNode(node);
          continue traversal; // Done with this node
        }
        
        dep = dep.nextDependency;
      }

      // No dependencies were dirty, clear flags
      node.flags = 0; // Node is clean - clear flags immediately
    } while (stack)
  };

  return { pullUpdates };
}