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
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) {
          current.version++;
        }

        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      // OPTIMIZED: Single pass over dependencies
      let hasValueChange = false;
      let needsPull: DerivedNode | undefined;

      do {
        const producer: FromNode = dep.producer;

        // Check if this is a derived node that needs pulling
        if ('compute' in producer) {
          if (producer.status === STATUS_PENDING || producer.status === STATUS_DIRTY) {
            // Found a dependency that needs pulling - exit early and pull it
            needsPull = producer;
            break;
          }
        } else if (producer.status === STATUS_DIRTY) {
          // Handle dirty signal: increment version in pull phase
          producer.version++;
          producer.status = STATUS_CLEAN;
        }

        // Check for version changes (always do this)
        if (dep.producerVersion !== producer.version) {
          hasValueChange = true;
        }

        dep = dep.nextDependency;
      } while (dep);

      // If we found a node to pull, do it recursively
      if (needsPull) {
        stackHead = { node: current, prev: stackHead };
        current = needsPull;
        continue traversal;
      }

      // All dependencies pulled, now decide if recompute needed
      // Special case: If version is 0, this is the first computation with dependencies
      if (hasValueChange || current.version === 0) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) {
          current.version++;
        }
      }

      // After computing or skipping, the node is up-to-date
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;
      current = stackHead.node;
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}