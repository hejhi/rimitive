import type { Dependency, DerivedNode } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const { STATUS_DISPOSED, MASK_STATUS, STATUS_PENDING, DIRTY } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => boolean;
}

const { recomputeNode } = createNodeState();

export function createPullPropagator(): PullPropagator {
  const pullUpdates = (node: DerivedNode): boolean => {
    const flags = node.flags;

    // Fast path: disposed or already clean
    if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) return false;

    // Check dependencies recursively
    const recompute = () => recomputeNode(node);

    // If no dependencies yet (first run), must recompute
    if (!node.dependencies) return recomputeNode(node);

    let current: Dependency | undefined = node.dependencies;

    while (current) {
      const producer = current.producer;
      const producerFlags = producer.flags;

      // For signals: check DIRTY flag (set on write, cleared on read)
      if (producerFlags & DIRTY) return recompute();

      // For computeds: check version (only computeds have meaningful versions)
      if ('recompute' in producer) {
        // If already computed this cycle and changed after we last computed
        if (producer.lastChangedVersion > node.lastComputedVersion)
          return recompute();

        // If PENDING, we need to pull it to know if it changed
        if (producerFlags & STATUS_PENDING) {
          pullUpdates(producer);

          // After pulling, check if value changed via DIRTY flag
          // DIRTY will be set if the computed's value changed during recomputation
          if (producer.flags & DIRTY) return recompute();
        }
      }

      current = current.nextDependency;
    }

    // No dependencies changed, just clear PENDING status
    node.flags = flags & ~MASK_STATUS;
    return false;
  };

  return { pullUpdates };
}