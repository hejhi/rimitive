import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Alien-signals inspired depth limit for cycle detection
const MAX_DEPTH = 1000;

// Alien-signals style linked list stack node
interface StackNode {
  node: DerivedNode;
  prev: StackNode | undefined;
}


export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

// Shallow-check check sibling dependencies
const shallowCheck = (startDep: Dependency): boolean => {
  for (;;) {
    const producer = startDep.producer;

    if (producer.status === STATUS_DIRTY) return true;
    // Found pending computed - need deep check, exit shallow mode
    else if ('compute' in producer && producer.status === STATUS_PENDING) return false;

    const next = startDep.nextDependency;

    if (!next) return false;

    startDep = next;
  }
}

export function createPullPropagator({ ctx, track }: { ctx: GlobalContext, track: GraphEdges['track'] }): PullPropagator {
  const pullUpdates = (rootNode: DerivedNode): void => {
    let depth = 0;
    let current: DerivedNode = rootNode;
    let stackHead: StackNode | undefined;
    let oldValue: unknown;
    let newValue: unknown;

    // Single-pass traversal with linked list stack
    traversal: for (;;) {
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
          if (stackHead) stackHead.node.status = STATUS_DIRTY;
        } else current.status = STATUS_CLEAN;

        // Continue with parent from stack
        if (!stackHead) break;

        current = stackHead.node;
        stackHead = stackHead.prev;
        depth--;

        continue;
      }

      // PENDING status with dependencies - need to check them
      let dep: Dependency | undefined = current.dependencies;

      if (shallowCheck(dep)) {
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
      do {
        const producer = dep.producer;

        // Skip CLEAN dependencies
        if (producer.status === STATUS_CLEAN) {
          dep = dep.nextDependency;
          continue;
        }

        // PENDING computed - descend into it
        if (producer.status === STATUS_PENDING && 'compute' in producer) {
          if (depth >= MAX_DEPTH) {
            throw new Error(`Signal dependency cycle detected - exceeded max depth of ${MAX_DEPTH}`);
          }

          stackHead = { node: current, prev: stackHead };
          current = producer;
          depth++;

          continue traversal;
        }

        dep = dep.nextDependency;
      } while (dep);

      // All dependencies clean - only update status if needed
      if (current.status !== STATUS_CLEAN) current.status = STATUS_CLEAN;
      if (!stackHead) break;

      current = stackHead.node;
      stackHead = stackHead.prev;
      depth--;
    };
  };

  return { pullUpdates };
}
