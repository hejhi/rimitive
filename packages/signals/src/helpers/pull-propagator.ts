import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

// Lightweight inline stack like alien-signals
interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

/**
 * OPTIMIZATION: Uses lightweight inline stack like alien-signals
 *
 * Benefits:
 * - No memory writes to node.deferredParent during traversal
 * - Minimal allocation - only when multiple paths exist
 * - No method call overhead for push/pop
 * - Simple control flow without isEmpty() checks
 */
export function createPullPropagator({ ctx, track }: { ctx: GlobalContext, track: GraphEdges['track'] }): PullPropagator {
  const pullUpdates = (rootNode: DerivedNode): void => {
    let stack: Stack<DerivedNode> | undefined;
    let current: DerivedNode = rootNode;
    let oldValue: unknown;
    let newValue: unknown;

    // Single-pass traversal with inline stack
    traversal: do {

        // Early exit for clean nodes
        if (current.status === STATUS_CLEAN) {
          // Pop from stack and continue
          if (!stack) break;
          current = stack.value;
          stack = stack.prev;
          continue;
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
            // Mark parent (if on stack) as dirty
            if (stack) {
              stack.value.status = STATUS_DIRTY;
            }
          } else {
            current.status = STATUS_CLEAN;
          }

          // Continue with parent from stack
          if (!stack) break;
          current = stack.value;
          stack = stack.prev;
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
          if (!stack) break;
          current = stack.value;
          stack = stack.prev;
          continue;
        }

        // Additional optimization: if first dep is DIRTY, recompute immediately without loop
        if (firstStatus === STATUS_DIRTY) {
          oldValue = current.value;
          newValue = track(ctx, current, current.compute);

          if (newValue !== oldValue) {
            current.value = newValue;
            current.status = STATUS_DIRTY;
            // Mark parent (if on stack) as dirty
            if (stack) {
              stack.value.status = STATUS_DIRTY;
            }
          } else {
            current.status = STATUS_CLEAN;
          }

          if (!stack) break;
          current = stack.value;
          stack = stack.prev;
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
              // Mark parent (if on stack) as dirty
              if (stack) {
                stack.value.status = STATUS_DIRTY;
              }
            } else {
              current.status = STATUS_CLEAN;
            }

            if (!stack) break traversal;
            current = stack.value;
            stack = stack.prev;
            continue traversal;
          }

          // PENDING computed - descend into it
          if ('compute' in producer) {
            const derivedProducer = producer as DerivedNode;
            // Push current onto stack before descending (inline allocation)
            stack = { value: current, prev: stack };
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

        if (!stack) break;
        current = stack.value;
        stack = stack.prev;
      } while (true);
    // No need to clear - stack goes out of scope and GC handles it
  };

  return { pullUpdates };
}
