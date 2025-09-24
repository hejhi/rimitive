import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

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

      // Handle dirty nodes or nodes without dependencies - both need immediate recomputation
      if (current.status === STATUS_DIRTY || !current.dependencies) {
        // Inline recomputation
        oldValue = current.value;
        newValue = track(ctx, current, current.compute);

        // Only set status if value changed
        if (newValue !== oldValue) {
          current.value = newValue;
          current.status = STATUS_DIRTY;
          // Propagate to parent
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

      // PENDING status with dependencies - need to check them
      let dep = current.dependencies!; // We know it exists from the check above

      // Optimized: Check if all deps might be clean by sampling first
      const firstProducer = dep.producer;
      const firstStatus = firstProducer.status;

      // Common case optimization: if first dep is CLEAN and no next dep, we're done
      if (firstStatus === STATUS_CLEAN && !dep.nextDependency) {
        current.status = STATUS_CLEAN;
        current.deferredParent = undefined;
        if (!parent) break;
        current = parent;
        continue;
      }

      // Additional optimization: if first dep is DIRTY, recompute immediately without loop
      if (firstStatus === STATUS_DIRTY) {
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

      // Traverse dependencies - optimized loop
      while (dep) {
        const producer = dep.producer;
        const depStatus = producer.status;

        // Fast path: CLEAN dependency, skip to next
        if (depStatus === STATUS_CLEAN) {
          const next = dep.nextDependency;
          if (!next) break; // All remaining deps checked
          dep = next;
          continue;
        }

        // DIRTY dependency found - recompute immediately
        if (depStatus === STATUS_DIRTY) {
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

        // PENDING computed - descend into it
        if ('compute' in producer) {
          const derivedProducer = producer as DerivedNode;
          derivedProducer.deferredParent = current;
          current = derivedProducer;
          continue traversal;
        }

        // Move to next dependency (signal dependencies should be CLEAN, skip)
        const next = dep.nextDependency;
        if (!next) break; // All remaining deps checked
        dep = next;
      }

      // All dependencies clean - only update status if needed
      if (current.status !== STATUS_CLEAN) {
        current.status = STATUS_CLEAN;
      }
      current.deferredParent = undefined;

      if (!parent) break;
      current = parent;
    } while (true);
  };

  return { pullUpdates };
}
