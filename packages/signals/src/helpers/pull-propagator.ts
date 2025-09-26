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


export function createPullPropagator({ ctx, track }: { ctx: GlobalContext, track: GraphEdges['track'] }): PullPropagator {
  // Extract single recomputation function to eliminate duplication
  const recomputeNode = (node: DerivedNode, stackHead?: StackNode) => {
    const oldValue = node.value;
    const newValue = track(ctx, node, node.compute);

    if (newValue !== oldValue) {
      node.value = newValue;
      node.status = STATUS_DIRTY;
      // Mark parent (if on stack) as dirty
      if (stackHead) stackHead.node.status = STATUS_DIRTY;
    } else {
      node.status = STATUS_CLEAN;
    }
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode = rootNode;
    let stackHead: StackNode | undefined;

    // Single-pass traversal with linked list stack
    traversal: for (;;) {
      // Early exit for clean nodes
      if (current.status === STATUS_CLEAN) {
        // Pop from linked list stack and continue
        if (!stackHead) break;

        current = stackHead.node;
        stackHead = stackHead.prev;

        continue;
      }

      // Handle dirty nodes or nodes without dependencies - both need immediate recomputation
      if (current.status === STATUS_DIRTY || !current.dependencies) {
        recomputeNode(current, stackHead);

        // Continue with parent from stack
        if (!stackHead) break;

        current = stackHead.node;
        stackHead = stackHead.prev;

        continue;
      }

      // PENDING status with dependencies - check them for dirty/pending nodes
      let dep: Dependency | undefined = current.dependencies;

      do {
        const producer = dep.producer;

        // Skip CLEAN dependencies
        if (producer.status === STATUS_CLEAN) {
          dep = dep.nextDependency;
          continue;
        }

        // DIRTY dependency found - recompute immediately
        if (producer.status === STATUS_DIRTY) {
          recomputeNode(current, stackHead);

          if (!stackHead) break;

          current = stackHead.node;
          stackHead = stackHead.prev;
  
          continue traversal;
        }

        // PENDING computed - descend into it
        if (producer.status === STATUS_PENDING && 'compute' in producer) {

          stackHead = { node: current, prev: stackHead };
          current = producer;

          continue traversal;
        }

        dep = dep.nextDependency;
      } while (dep);

      // All dependencies clean - only update status if needed
      if (current.status !== STATUS_CLEAN) current.status = STATUS_CLEAN;
      if (!stackHead) break;

      current = stackHead.node;
      stackHead = stackHead.prev;
    };
  };

  return { pullUpdates };
}
