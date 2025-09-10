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
  needsUpdate: boolean;
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
    if (valueChanged) {
      node.flags = (node.flags & ~MASK_STATUS) | DIRTY;
      
      // If node has multiple dependents, use shallow propagation
      // This avoids deep traversal for nodes with many subscribers
      const firstDep = node.dependents;

      if (firstDep && firstDep.nextDependent) {
        let dep: Dependency | undefined = firstDep;

        while (dep) {
          const consumer = dep.consumer;
          const flags = consumer.flags;
          // Mark as DIRTY if it's PENDING
          if (flags & STATUS_PENDING) consumer.flags = flags | DIRTY;

          dep = dep.nextDependent;
        }
      }
    } else {
      // Clear both status AND DIRTY flag when value doesn't change
      node.flags = node.flags & ~(MASK_STATUS | DIRTY);
    }
    
    return valueChanged;
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let stack: StackFrame | undefined = { node: rootNode, next: undefined, needsUpdate: false };

    while (stack) {
      const { node } = stack;
      const flags = node.flags;
      
      // Skip disposed or non-pending nodes
      if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) {
        stack = stack.next;
        continue;
      }
      
      // No dependencies - just recompute
      if (!node.dependencies) {
        recomputeNode(node);
        stack = stack.next;
        continue;
      }

      // Start checking dependencies
      let dep: Dependency | undefined = node.dependencies;
      
      // Check remaining dependencies
      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;
        
        // If dependency is already dirty, we need to update
        if (pFlags & DIRTY) {
          stack.needsUpdate = true;
          // Continue checking other deps to potentially update them too
          dep = dep.nextDependency;
          continue;
        }
        
        // If dependency is a pending computed, update it inline
        if ('compute' in producer && pFlags & STATUS_PENDING) {
          // Update the computed inline and check if it became dirty
          const changed = recomputeNode(producer);
          if (changed) {
            stack.needsUpdate = true;
          }
          // Continue to next dependency
          dep = dep.nextDependency;
          continue;
        }
        
        dep = dep.nextDependency;
      }
      
      // If we've checked all dependencies
      if (!dep) {
        if (stack.needsUpdate) {
          recomputeNode(node);
        } else {
          // Node is clean - clear flags immediately
          node.flags = flags & ~(MASK_STATUS | DIRTY);
        }
        stack = stack.next;
      }
    }

    rootNode.flags &= ~DIRTY;
  };

  return { pullUpdates };
}