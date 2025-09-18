import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_PENDING, STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

export function createPullPropagator({ ctx, track }: { ctx: GlobalContext, track: GraphEdges['track'] }): PullPropagator {
  // Inline recomputation logic here since we have access to context
  const recomputeNode = (node: DerivedNode): boolean => {
    const oldValue = node.value;
    const newValue = track(ctx, node, node.compute);

    // Update value and set status based on whether it changed
    if (newValue !== oldValue) {
      node.value = newValue;
      node.status = STATUS_DIRTY;
      return true;
    }

    // Value didn't change, clear status
    node.status = STATUS_CLEAN;
    return false;
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode | undefined = rootNode;

    traversal: while (current) {
      const parent: DerivedNode | undefined = current.deferredParent;
      const status = current.status;

      // Skip clean nodes
      if (status === STATUS_CLEAN) {
        current = parent;
        continue;
      }

      // DIRTY = recompute immediately
      if (status === STATUS_DIRTY) {
        if (recomputeNode(current) && parent) parent.status = STATUS_DIRTY;
        current = parent;
        continue;
      }

      // PENDING = check dependencies
      let dep = current.dependencies;

      // No deps? Just recompute
      if (!dep) {
        if (recomputeNode(current) && parent) parent.status = STATUS_DIRTY;
        current = parent;
        continue;
      }

      // Scan dependencies for work
      while (dep) {
        const pStatus = dep.producer.status;

        if (pStatus === STATUS_DIRTY) {
          // Dirty dep found - recompute
          if (recomputeNode(current) && parent) parent.status = STATUS_DIRTY;
          current = parent;
          continue traversal;
        }

        if (pStatus === STATUS_PENDING && 'compute' in dep.producer) {
          // Pending computed - traverse it
          dep.producer.deferredParent = current;
          current = dep.producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      }

      // All deps clean
      current.status = STATUS_CLEAN;
      current = parent;
    }
  };

  return { pullUpdates };
}
