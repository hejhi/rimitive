import type { Dependency, DerivedNode, FromNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

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
  // Simple recomputation function
  const recomputeNode = (node: DerivedNode) => {
    const oldValue = node.value;
    const newValue = track(ctx, node, node.compute);

    if (newValue !== oldValue) {
      node.value = newValue;
      node.status = STATUS_DIRTY;
    } else node.status = STATUS_CLEAN;
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode | undefined = rootNode;
    let stackHead: StackNode | undefined;

    traversal: do {
      if (current.status === STATUS_CLEAN) {
        // Pop from linked list stack and continue
        if (stackHead === undefined) break;

        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }
      // Check dependencies for dirty/pending nodes
      let dep: Dependency | undefined = current.dependencies;

      if (dep === undefined) {
        recomputeNode(current);

        // Pop from linked list stack and continue
        if (!stackHead) break;

        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      do {
        const producer: FromNode = dep.producer;

        // If dependency is dirty, recompute immediately
        if (producer.status === STATUS_DIRTY) {
          recomputeNode(current);

          // Pop from linked list stack and continue
          if (stackHead === undefined) break traversal;

          current = stackHead.node;
          stackHead = stackHead.prev;
          continue traversal;
        }

        // If dependency is pending and computed, descend into it
        if (producer.status !== STATUS_CLEAN && 'compute' in producer) {
          // Push current node onto linked list stack
          stackHead = { node: current, prev: stackHead };
          current = producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      } while (dep);

      // All dependencies clean - mark current as clean
      current.status = STATUS_CLEAN;

      // Pop from linked list stack and continue
      if (stackHead === undefined) break;

      current = stackHead.node;
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}
