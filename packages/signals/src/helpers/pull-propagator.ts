import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_PENDING, STATUS_DIRTY, MASK_STATUS } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

export function createPullPropagator(
  ctx: GlobalContext & { graphEdges: GraphEdges }
): PullPropagator {
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
      const parent: DerivedNode | undefined = current.deferredParent;
      const status = current.flags & MASK_STATUS;

      // Skip clean or invalid nodes
      if (!status || status & ~(STATUS_PENDING | STATUS_DIRTY)) {
        current = parent;
        continue;
      }

      // DIRTY = recompute immediately
      if (status === STATUS_DIRTY) {
        if (recomputeNode(current) && parent) parent.flags = STATUS_DIRTY;
        current = parent;
        continue;
      }

      // PENDING = check dependencies
      let dep = current.dependencies;

      // No deps? Just recompute
      if (!dep) {
        if (recomputeNode(current) && parent) parent.flags = STATUS_DIRTY;
        current = parent;
        continue;
      }

      // Scan dependencies for work
      while (dep) {
        const pFlags = dep.producer.flags;

        if (pFlags === STATUS_DIRTY) {
          // Dirty dep found - recompute
          if (recomputeNode(current) && parent) parent.flags = STATUS_DIRTY;
          current = parent;
          continue traversal;
        }

        if (pFlags === STATUS_PENDING && 'compute' in dep.producer) {
          // Pending computed - traverse it
          dep.producer.deferredParent = current;
          current = dep.producer as DerivedNode;
          continue traversal;
        }

        dep = dep.nextDependency;
      }

      // All deps clean
      current.flags = 0;
      current = parent;
    }
  };

  return { pullUpdates };
}
