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
    // If root node is clean, nothing to do
    if (rootNode.status === STATUS_CLEAN) return;

    // For nodes without dependencies, just recompute directly
    if (!rootNode.dependencies) {
      recomputeNode(rootNode);
      return;
    }

    // Check if any dependencies need updates first
    let needsUpdate = false;
    let dep: Dependency | undefined = rootNode.dependencies;

    while (dep) {
      const producer = dep.producer;

      // If dependency is dirty, we need to update
      if (producer.status === STATUS_DIRTY) {
        needsUpdate = true;
        break;
      }

      // If dependency is pending and has compute, recursively pull it
      if (producer.status !== STATUS_CLEAN && 'compute' in producer) {
        pullUpdates(producer);

        // After pulling, check if it became dirty
        if (producer.status === STATUS_DIRTY) {
          needsUpdate = true;
          break;
        }
      }

      dep = dep.nextDependency;
    }

    // Only recompute if dependencies changed
    if (needsUpdate || rootNode.status === STATUS_DIRTY) recomputeNode(rootNode);
    else rootNode.status = STATUS_CLEAN;
  };

  return { pullUpdates };
}
