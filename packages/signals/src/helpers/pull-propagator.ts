import type { DerivedNode, Dependency } from '../types';
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
      const flags = node.flags;
      const status = flags & MASK_STATUS;

      // If node is DIRTY (from a dependency that changed), recompute it
      if (status === STATUS_DIRTY) {
        // If value changed and we have a parent, mark it for direct recompute
        const parent: DerivedNode | undefined = node.deferredParent;
        if (recomputeNode(node) && parent) parent.flags = STATUS_DIRTY;
        
        // Clean up and continue with parent
        node.deferredParent = undefined;
        current = parent;
        continue;
      }

      // Skip disposed or already-processed nodes
      // Continue only if PENDING and not DISPOSED
      if (status !== STATUS_PENDING) {
        // Continue with parent or finish
        const parent: DerivedNode | undefined = node.deferredParent;
        node.deferredParent = undefined;
        current = parent;
        continue;
      }

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
      // If we have a deferred dependency, resume from there
      let dep: Dependency | undefined = node.deferredDep || node.dependencies;
      node.deferredDep = undefined; // Clear the deferred marker

      // No dependencies - just recompute
      if (!dep) {
        const parent: DerivedNode | undefined = node.deferredParent;
        if (recomputeNode(node) && parent) parent.flags = STATUS_DIRTY;
        
        // Clean up and continue with parent
        node.deferredParent = undefined;
        current = parent;
        continue;
      }

      while (dep) {
        const producer = dep.producer;
        const pStatus = producer.flags & MASK_STATUS;

        switch (pStatus) {
          case STATUS_DIRTY: {
            // If value changed and we have a parent, mark it dirty
            const parent: DerivedNode | undefined = node.deferredParent;
            if (recomputeNode(node) && parent) parent.flags = STATUS_DIRTY;
            
            // Clean up and continue with parent
            node.deferredParent = undefined;
            current = parent;
            continue traversal; // Done with this node
          }
          case STATUS_PENDING:
            if ('compute' in producer) {
              // Store where we are in the dependency list
              node.deferredDep = dep.nextDependency;
              // Link producer back to current node
              producer.deferredParent = node;
              // Process the dependency next
              current = producer;
              continue traversal; // Process the dependency first
            }
        }
        
        dep = dep.nextDependency;
      }

      // No dependencies were dirty or pending, clear flags
      node.flags = 0;
      
      // Continue with parent or finish
      const parent: DerivedNode | undefined = node.deferredParent;
      node.deferredParent = undefined;
      current = parent;
    }
  };

  return { pullUpdates };
}