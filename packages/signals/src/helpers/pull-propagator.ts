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
        current.value = track(ctx, current, current.compute);
        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      // Phase 1: Pull ALL pending dependencies first
      do {
        const producer: FromNode = dep.producer;

        if ('compute' in producer && producer.status === STATUS_PENDING) {
          // Found a pending dependency - must pull it first
          stackHead = { node: current, prev: stackHead };
          current = producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      } while (dep);

      // Phase 2: After all pending are resolved, check for dirty derived nodes
      dep = current.dependencies;

      while (dep) {
        const producer: FromNode = dep.producer;

        // If a dependency is a dirty derived node, it needs to be pulled first
        if ('compute' in producer && producer.status === STATUS_DIRTY) {
          stackHead = { node: current, prev: stackHead };
          current = producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      }

      // Phase 3: Check if any dependency values have changed (dirty source nodes)
      dep = current.dependencies;
      let hasDirty = false;

      while (dep) {
        const producer: FromNode = dep.producer;

        if (producer.status === STATUS_DIRTY) {
          hasDirty = true;
          break;
        }

        dep = dep.nextDependency;
      }

      // Phase 4: Recompute if any dependency was dirty OR if node never computed
      if (hasDirty || current.status === STATUS_PENDING) {
        current.value = track(ctx, current, current.compute);
        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break traversal;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue traversal;
      }

      // All dependencies are clean and node is already computed
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;
      current = stackHead.node;
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}