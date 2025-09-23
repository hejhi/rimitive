import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_PENDING, STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

/**
 * OPTIMIZATION NOTES:
 *
 * Current implementation uses the `deferredParent` field on each node for traversal state.
 * This causes memory writes for every traversal, even in single-subscriber chains.
 *
 * Alien-signals optimizes this by:
 * 1. Using a separate stack allocation ONLY when there are multiple paths
 * 2. For single-subscriber chains, using implicit recursion depth
 *
 * Future optimization opportunities:
 * 1. Replace deferredParent with an external stack pool
 * 2. Only allocate stack frames when multiple subscribers exist
 * 3. Use a pre-allocated stack array to avoid GC pressure
 *
 * Current workaround: We clear deferredParent as soon as possible to reduce
 * the time references are held, but the field itself is still set during traversal.
 */
export function createPullPropagator({ ctx, track }: { ctx: GlobalContext, track: GraphEdges['track'] }): PullPropagator {
  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode = rootNode;
    let parent: DerivedNode | undefined;
    let oldValue: unknown;
    let newValue: unknown;

    // Single-pass traversal with pre-declared variables
    traversal: do {
      parent = current.deferredParent;

      // Early exit for clean nodes
      if (current.status === STATUS_CLEAN) {
        // Clear parent ref immediately
        if (parent) {
          current.deferredParent = undefined;
          current = parent;
          continue;
        }
        break;
      }

      // Handle dirty nodes
      if (current.status === STATUS_DIRTY) {
        // Inline recomputation
        oldValue = current.value;
        newValue = track(ctx, current, current.compute);

        // Only set status if value changed
        if (newValue !== oldValue) {
          current.value = newValue;
          // Keep DIRTY status, propagate to parent
          if (parent) parent.status = STATUS_DIRTY;
        } else {
          current.status = STATUS_CLEAN;
        }

        // Clear and continue
        current.deferredParent = undefined;
        if (!parent) break;
        current = parent;
        continue;
      }

      // PENDING status - need to check dependencies
      let dep = current.dependencies;

      // Handle nodes without dependencies
      if (!dep) {
        // Recompute inline
        oldValue = current.value;
        newValue = track(ctx, current, current.compute);

        if (newValue !== oldValue) {
          current.value = newValue;
          current.status = STATUS_DIRTY;
          if (parent) parent.status = STATUS_DIRTY;
        } else {
          current.status = STATUS_CLEAN;
        }

        current.deferredParent = undefined;
        if (!parent) break;
        current = parent;
        continue;
      }

      // Traverse dependencies
      for (;;) {
        // Check dependency status inline
        if (dep.producer.status === STATUS_DIRTY) {
          // Dirty dependency found - recompute immediately
          oldValue = current.value;
          newValue = track(ctx, current, current.compute);

          if (newValue !== oldValue) {
            current.value = newValue;
            current.status = STATUS_DIRTY;
            if (parent) parent.status = STATUS_DIRTY;
          } else {
            current.status = STATUS_CLEAN;
          }

          current.deferredParent = undefined;
          if (!parent) break traversal;
          current = parent;
          continue traversal;
        }

        // Pending computed found - descend into it
        if (dep.producer.status === STATUS_PENDING && 'compute' in dep.producer) {
          dep.producer.deferredParent = current;
          current = dep.producer;
          continue traversal;
        }

        // Check next dependency
        dep = dep.nextDependency;
        if (!dep) break;
      }

      // All dependencies clean
      current.status = STATUS_CLEAN;
      current.deferredParent = undefined;

      if (!parent) break;
      current = parent;
    } while (true);
  };

  return { pullUpdates };
}
