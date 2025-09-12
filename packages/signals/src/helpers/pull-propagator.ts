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
      const status = node.flags & MASK_STATUS;
      
      // Read parent once (but don't clear yet - we might defer)
      const parent: DerivedNode | undefined = node.deferredParent;

      // If node is DIRTY (from a dependency that changed), recompute it
      if (status === STATUS_DIRTY) {
        // If value changed and we have a parent, mark it for direct recompute
        if (recomputeNode(node) && parent) parent.flags = STATUS_DIRTY;
        node.deferredParent = undefined;
        current = parent;
        continue;
      }

      // Skip disposed or already-processed nodes
      // Continue only if PENDING and not DISPOSED
      if (status !== STATUS_PENDING) {
        node.deferredParent = undefined;
        current = parent;
        continue;
      }

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
      // If we have a deferred dependency, resume from there
      let dep: Dependency | undefined;
      if (node.deferredDep) {
        dep = node.deferredDep;
        node.deferredDep = undefined; // Clear only if it was set
      } else dep = node.dependencies;

      // No dependencies - just recompute
      if (!dep) {
        if (recomputeNode(node) && parent) parent.flags = STATUS_DIRTY;
        node.deferredParent = undefined;
        current = parent;
        continue;
      }

      while (dep) {
        const producer = dep.producer;
        const pStatus = producer.flags & MASK_STATUS;

        if (pStatus === STATUS_DIRTY) {
          // If value changed and we have a parent, mark it dirty
          if (recomputeNode(node) && parent) parent.flags = STATUS_DIRTY;
          node.deferredParent = undefined;
          current = parent;
          continue traversal; // Done with this node
        }
        
        if (pStatus === STATUS_PENDING && 'compute' in producer) {
          // Store where we are in the dependency list
          node.deferredDep = dep.nextDependency;
          // Link producer back to current node
          producer.deferredParent = node;
          // Process the dependency next
          current = producer;
          continue traversal; // Process the dependency first
        }
        
        dep = dep.nextDependency;
      }

      // No dependencies were dirty or pending, clear flags
      node.flags = 0;
      node.deferredParent = undefined;
      current = parent;
    }
  };

  return { pullUpdates };
}