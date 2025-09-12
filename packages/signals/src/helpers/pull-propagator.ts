import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_PENDING, STATUS_DIRTY, MASK_STATUS } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

export function createPullPropagator(ctx: GlobalContext & { graphEdges: GraphEdges }): PullPropagator {
  const { startTracking, endTracking } = ctx.graphEdges;

  // Inline recomputation logic here since we have access to context
  const recomputeNode = (node: DerivedNode): boolean => {
    const prevConsumer = startTracking(ctx, node);
    const oldValue = node.value;

    try {
      const newValue = node.compute();

      // Update value and set flags based on whether it changed
      if (newValue !== oldValue) {
        node.value = newValue;
        node.flags = STATUS_DIRTY;
        return true;
      }
      
      // Value didn't change, clear flags
      node.flags = 0;
      return false;
    } finally {
      // End tracking, restore context, and prune stale dependencies
      endTracking(ctx, node, prevConsumer);
    }
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode | undefined = rootNode;

    traversal: while (current) {
      const node: DerivedNode = current;
      const status = node.flags & MASK_STATUS;
      
      current = node.deferredParent;

      // Fast path: Skip if not PENDING or DIRTY (most common case)
      if (!status || (status & ~(STATUS_PENDING | STATUS_DIRTY))) {
        node.deferredParent = undefined;
        continue;
      }

      // If node is DIRTY (from a dependency that changed), recompute it
      if (status === STATUS_DIRTY) {
        // If value changed and we have a parent, mark it for direct recompute
        if (recomputeNode(node) && current) current.flags = STATUS_DIRTY;
        node.deferredParent = undefined;
        continue;
      }

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
      // If we have a deferred dependency, resume from there
      let dep = node.dependencies;

      // No dependencies - just recompute
      if (!dep) {
        if (recomputeNode(node) && current) current.flags = STATUS_DIRTY;
        node.deferredParent = undefined;
        continue;
      }

      // Multiple dependencies - need full loop
      while (dep) {
        const producer = dep.producer;
        const pStatus = producer.flags & MASK_STATUS;

        switch (pStatus) {
          case STATUS_DIRTY:{
            if (recomputeNode(node) && current) current.flags = STATUS_DIRTY;
            node.deferredParent = undefined;
            continue traversal;
          }
          case STATUS_PENDING: {
            // Checking compute here is redundant as STATUS_PENDING can't be on a signal anyway...
            if ('compute' in producer) {
              // Link producer back to current node
              producer.deferredParent = node;
              // Process the dependency next
              current = producer;
            } else {
              node.flags = 0;
              node.deferredParent = undefined;
            }
            continue traversal;
          }
        }
        
        dep = dep.nextDependency;
      }

      // No dependencies were dirty or pending, clear flags
      node.flags = 0;
      node.deferredParent = undefined;
    }
  };

  return { pullUpdates };
}