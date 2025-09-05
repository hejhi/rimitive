import type { Dependency, DerivedNode } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const { DIRTY, STATUS_DISPOSED, MASK_STATUS, STATUS_PENDING } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

const { recomputeNode } = createNodeState();

export function createPullPropagator(): PullPropagator {
  const pullUpdates = (node: DerivedNode): void => {
    const flags = node.flags;
    
    // Fast path: disposed or already clean
    if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) return;
    
    // Check if any dependencies have DIRTY flag   
      // If no dependencies yet (first run), must recompute
      if (!node.dependencies) {
        recomputeNode(node);
        return;
      }
      
      let current: Dependency | undefined = node.dependencies;

      while (current) {
        const producer = current.producer;
        // Direct flag check without intermediate variable
        if (producer.flags & DIRTY) {
          recomputeNode(node);
          return;
        }

        current = current.nextDependency;
      }
    
    node.flags = flags & ~MASK_STATUS;
  };

  return { pullUpdates };
}