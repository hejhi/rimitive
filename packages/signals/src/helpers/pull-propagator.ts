import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

// Note: No longer need StackNode interface - using queue-based approach


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
    let nodeStack: DerivedNode[] | undefined;

    traversal: while (current) {
      if (current.status === STATUS_CLEAN) {
        // Pop from stack and continue
        if (!nodeStack?.length) break;
        current = nodeStack.pop()!;
        continue;
      }

      if (!current.dependencies) {
        recomputeNode(current);
        // Pop from stack and continue
        if (!nodeStack?.length) break;
        current = nodeStack.pop()!;
        continue;
      }

      // Check dependencies for dirty/pending nodes
      let dep: Dependency | undefined = current.dependencies;

      while (dep) {
        const producer = dep.producer;

        // If dependency is dirty, recompute immediately
        if (producer.status === STATUS_DIRTY) {
          recomputeNode(current);
          // Pop from stack and continue
          if (!nodeStack?.length) break traversal;
          current = nodeStack.pop()!;
          continue traversal;
        }

        // If dependency is pending and computed, descend into it
        if (producer.status !== STATUS_CLEAN && 'compute' in producer) {
          // Lazy stack allocation
          if (!nodeStack) nodeStack = [];
          nodeStack.push(current);
          current = producer as DerivedNode;
          continue traversal;
        }

        dep = dep.nextDependency;
      }

      // All dependencies clean - mark current as clean
      current.status = STATUS_CLEAN;
      // Pop from stack and continue
      if (!nodeStack?.length) break;
      current = nodeStack.pop()!;
    }
  };

  return { pullUpdates };
}
