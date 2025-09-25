import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Pooled manual array stack for zero-allocation, zero-method-call performance
interface StackPool {
  nodes: DerivedNode[];
  size: number;
}


export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

/**
 * OPTIMIZATION: Uses pooled manual array management
*
* Benefits:
* - Zero allocations (pooled arrays)
* - Zero method calls (manual indexing)
* - Clean architecture (no node pollution)
* - Debuggable (visible stack state)
*/
export function createPullPropagator({ ctx, track }: { ctx: GlobalContext, track: GraphEdges['track'] }): PullPropagator {
  // Global pool of reusable stack structures
  const stackPool: (StackPool | undefined)[] = [];

  // Alien-signals style shallow propagation: efficiently check sibling dependencies
  function shallowCheck(startDep: DerivedNode['dependencies']): boolean {
    // Check multiple dependencies at shallow level without deep traversal
    let dep = startDep;
    let foundDirty = false;

    while (dep) {
      const producer = dep.producer;
      if (producer.status === STATUS_DIRTY) {
        foundDirty = true;
        break;
      } else if (producer.status === STATUS_PENDING && 'compute' in producer) {
        // Found pending computed - need deep check, exit shallow mode
        return false;
      }
      dep = dep.nextDependency;
    }

    return foundDirty;
  }

  const pullUpdates = (rootNode: DerivedNode): void => {
    // Lazy allocation - only create stack when needed
    let stackObj: StackPool | null = null;
    let stack: DerivedNode[] | null = null;
    let stackTop = -1; // Manual stack pointer
    let depth = 0; // Track traversal depth like alien-signals

    let current: DerivedNode = rootNode;
    let oldValue: unknown;
    let newValue: unknown;

    try {
      // Single-pass traversal with manual array stack
      traversal: do {
        // Early exit for clean nodes
        if (current.status === STATUS_CLEAN) {
          // Manual pop from stack and continue
          if (stackTop < 0) break;
          current = stack![stackTop--]!;
          depth--;
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
            if (stackTop >= 0) {
              stack![stackTop]!.status = STATUS_DIRTY;
            }
          } else {
            current.status = STATUS_CLEAN;
          }

          // Continue with parent from stack
          if (stackTop < 0) break;
          current = stack![stackTop--]!;
          depth--;
          continue;
        }

        // PENDING status with dependencies - need to check them
        let dep = current.dependencies!; // We know it exists from the check above

        // ALIEN-SIGNALS SHALLOW CHECK: Try shallow propagation first
        const shallowResult = shallowCheck(dep);
        if (shallowResult) {
          // Found dirty in shallow check - can recompute immediately
          oldValue = current.value;
          newValue = track(ctx, current, current.compute);

          if (newValue !== oldValue) {
            current.value = newValue;
            current.status = STATUS_DIRTY;
            if (stackTop >= 0 && stack) {
              stack[stackTop]!.status = STATUS_DIRTY;
            }
          } else {
            current.status = STATUS_CLEAN;
          }

          if (stackTop < 0) break;
          current = stack![stackTop--]!;
          depth--;
          continue;
        }

        // Find first PENDING computed to descend into (DIRTY cases handled by shallowCheck)
        while (dep) {
          const producer = dep.producer;

          // Skip CLEAN dependencies
          if (producer.status === STATUS_CLEAN) {
            const next = dep.nextDependency;
            if (!next) break;
            dep = next;
            continue;
          }

          // PENDING computed - descend into it
          if (producer.status === STATUS_PENDING && 'compute' in producer) {
            const derivedProducer = producer as DerivedNode;
            // Lazy allocation - only create stack when we need to push
            if (!stackObj) {
              stackObj = stackPool.pop() || { nodes: new Array(32), size: 0 };
              stack = stackObj.nodes;
            }
            // Manual push onto stack before descending
            stack![++stackTop] = current;
            depth++;
            current = derivedProducer;
            continue traversal;
          }

          const next = dep.nextDependency;
          if (!next) break;
          dep = next;
        }

        // All dependencies clean - only update status if needed
        if (current.status !== STATUS_CLEAN) {
          current.status = STATUS_CLEAN;
        }

        if (stackTop < 0) break;
        current = stack![stackTop--]!;
        depth--;
      } while (true);
    } finally {
      // Clean and return stack to pool (only if allocated)
      if (stackObj) {
        stackObj.size = 0;
        stackPool.push(stackObj);
      }
    }
  };

  return { pullUpdates };
}
