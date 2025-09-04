import type { Dependency, ToNode } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const {
  STATUS_DIRTY,
  STATUS_DISPOSED,
  HAS_CHANGED,
  MASK_STATUS,
  MASK_STATUS_AWAITING,
} = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: ToNode) => void;
}

const { recomputeNode } = createNodeState();

export function createPullPropagator(): PullPropagator {
  const pullUpdates = (node: ToNode): void => {
    const flags = node.flags;
    
    // Fast path: disposed or already clean
    if ((flags & STATUS_DISPOSED) || !(flags & MASK_STATUS_AWAITING)) return;
    
    // Fast path: definitely dirty - no dependency check needed    
    if ('recompute' in node) {
      
      if (flags & STATUS_DIRTY) {
        recomputeNode(node);
        return;
      }

      let current: Dependency | undefined = node.dependencies;

      while (current) {
        const producer = current.producer;
        const flags = producer.flags;

        if (flags & HAS_CHANGED) {
          recomputeNode(node);
          break;
        }

        current = current.nextDependency;
      }
    }
    
    node.flags = flags & ~MASK_STATUS;
  };

  return { pullUpdates };
}