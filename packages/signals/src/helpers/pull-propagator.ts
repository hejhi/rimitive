import type { Dependency, DerivedNode } from '../types';
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

    traversal: do {
      const flags = current.flags;
      const parent = current.deferredParent;

      // Ultra-fast path: if flags is 0 (clean), skip immediately
      if (!flags) {
        current = current.deferredParent;
        continue;
      }

      const status = flags & MASK_STATUS;

      // Fast path: Skip if not PENDING or DIRTY
      if (status & ~(STATUS_PENDING | STATUS_DIRTY)) {
        current = parent;
        continue;
      }

      // If node is DIRTY (from a dependency that changed), recompute it
      if (status === STATUS_DIRTY) {
        // If value changed and we have a parent, mark it for direct recompute
        if (recomputeNode(current) && parent) parent.flags = STATUS_DIRTY;

        current = parent; // deferredParent cleared by endTracking in recomputeNode
        continue;
      }

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
      // If we have a deferred dependency, resume from there
      let dep = current.dependencies;

      // No dependencies - just recompute
      if (!dep) {
        if (recomputeNode(current) && parent) parent.flags = STATUS_DIRTY;
        current = parent;
        continue;
      }

      // Optimization: Quick scan for any non-clean dependencies
      // Most dependencies are clean in steady state
      let hasWork = false;
      let scanDep: Dependency | undefined = dep;
      while (scanDep) {
        if (scanDep.producer.flags) {
          hasWork = true;
          break;
        }
        scanDep = scanDep.nextDependency;
      }

      // Fast path: all dependencies are clean
      if (!hasWork) {
        current.flags = 0;
        current = parent;
        continue;
      }

      // Process dependencies that need work
      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;

        if (!pFlags) {
          dep = dep.nextDependency;
          continue;
        }

        // Direct STATUS_DIRTY check (triggers immediate recompute)
        if (pFlags === STATUS_DIRTY) {
          if (recomputeNode(current) && parent) parent.flags = STATUS_DIRTY;
          current = parent;
          continue traversal;
        }

        // PENDING computed nodes need traversal
        if ((pFlags & MASK_STATUS) === STATUS_PENDING && 'compute' in producer) {
          producer.deferredParent = current;
          current = producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      }

      // No dependencies were dirty or pending, clear flags
      current.flags = 0;
      current = parent;
    } while (current);
  };

  return { pullUpdates };
}
