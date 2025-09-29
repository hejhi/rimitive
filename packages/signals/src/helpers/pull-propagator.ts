import type { Dependency, DerivedNode, FromNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Linked list stack node for memory efficiency
interface StackNode {
  node: DerivedNode;
  prev: StackNode | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}


export function createPullPropagator({
  ctx,
  track
}: {
  ctx: GlobalContext,
  track: GraphEdges['track']
}): PullPropagator {
  // Recomputation function that sets status based on value change
  const recomputeNode = (node: DerivedNode) => {
    const oldValue = node.value;
    const newValue = track(ctx, node, node.compute);

    if (newValue !== oldValue) {
      node.value = newValue;
      // Mark as DIRTY so downstream nodes know the value changed
      node.status = STATUS_DIRTY;
      // Value unchanged, mark as CLEAN to prevent downstream recomputation
    } else node.status = STATUS_CLEAN;
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode | undefined = rootNode;
    let stackHead: StackNode | undefined;

    traversal: do {
      if (current.status === STATUS_CLEAN) {
        if (stackHead === undefined) break;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      let dep: Dependency | undefined = current.dependencies;

      if (dep === undefined) {
        recomputeNode(current);

        if (stackHead === undefined) break;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      // Check all dependencies first
      let hasDirty = false;
      let hasPending = false;

      do {
        const producer: FromNode = dep.producer;
        const pStatus = producer.status;

        if (pStatus === STATUS_DIRTY) {
          hasDirty = true;
          // Break on first dirty
          break;
        }

        if ('compute' in producer && pStatus === STATUS_PENDING) {
          hasPending = true;
        }

        dep = dep.nextDependency;
      } while (dep);

      // If any dependency is dirty, recompute
      if (hasDirty) {
        recomputeNode(current);

        if (stackHead === undefined) break traversal;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue traversal;
      }

      // If any dependency is pending (and none are dirty), pull it first
      if (hasPending) {
        dep = current.dependencies;

        if (dep) {
          do {
            const producer: FromNode = dep.producer;

            if ('compute' in producer && producer.status === STATUS_PENDING) {
              stackHead = { node: current, prev: stackHead };
              current = producer;
              continue traversal;
            }
            dep = dep.nextDependency;
          } while (dep);
        }
      }

      // All dependencies are clean
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;
      current = stackHead.node;
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}