import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Alien-signals style linked list stack node
interface StackNode {
  node: DerivedNode;
  prev: StackNode | undefined;
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
    // Alien-signals style linked list stack - only allocate nodes when needed
    let stackHead: StackNode | undefined;
    let depth = 0; // Track traversal depth like alien-signals

    let current: DerivedNode = rootNode;
    let oldValue: unknown;
    let newValue: unknown;

    // Single-pass traversal with linked list stack
    traversal: do {
        // Early exit for clean nodes
        if (current.status === STATUS_CLEAN) {
          // Pop from linked list stack and continue
          if (!stackHead) break;
          current = stackHead.node;
          stackHead = stackHead.prev;
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
            if (stackHead) {
              stackHead.node.status = STATUS_DIRTY;
            }
          } else {
            current.status = STATUS_CLEAN;
          }

          // Continue with parent from stack
          if (!stackHead) break;
          current = stackHead.node;
          stackHead = stackHead.prev;
          depth--;
          continue;
        }

        // PENDING status with dependencies - need to check them
        let dep: Dependency | undefined = current.dependencies; // We know it exists from the check above

        const shallowResult = shallowCheck(dep);

        if (shallowResult) {
          // Found dirty in shallow check - can recompute immediately
          oldValue = current.value;
          newValue = track(ctx, current, current.compute);

          if (newValue !== oldValue) {
            current.value = newValue;
            current.status = STATUS_DIRTY;

            if (stackHead) stackHead.node.status = STATUS_DIRTY;
          } else current.status = STATUS_CLEAN;

          if (!stackHead) break;

          current = stackHead.node;
          stackHead = stackHead.prev;
          depth--;
          continue;
        }

        // Find first PENDING computed to descend into (DIRTY cases handled by shallowCheck)
        while (dep) {
          const producer = dep.producer;

          // Skip CLEAN dependencies
          if (producer.status === STATUS_CLEAN) {
            dep = dep.nextDependency;
            continue;
          }

          // PENDING computed - descend into it
          if (producer.status === STATUS_PENDING && 'compute' in producer) {
            const derivedProducer = producer as DerivedNode;
            // Alien-signals push: create new stack node
            stackHead = { node: current, prev: stackHead };
            depth++;
            current = derivedProducer;
            continue traversal;
          }

          dep = dep.nextDependency;
          
          if (!dep) break;
        }

        // All dependencies clean - only update status if needed
        if (current.status !== STATUS_CLEAN) current.status = STATUS_CLEAN;
        if (!stackHead) break;

        current = stackHead.node;
        stackHead = stackHead.prev;
        depth--;
      } while (true);
  };

  return { pullUpdates };
}
