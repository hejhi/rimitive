import type { ToNode } from '../types';
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
    
    const isComputed = 'recompute' in node;
    const cleanFlags = flags & ~MASK_STATUS;
    
    // Fast path: definitely dirty - no dependency check needed
    if (flags & STATUS_DIRTY) {
      if (isComputed) recomputeNode(node);
      else node.flags = cleanFlags; // Clear to CLEAN
      return;
    }
    
    // Pending path: check dependencies for changes
    let dep = node.dependencies;
    
    // Early termination loop - stop as soon as we find a change
    while (dep) {
      const producer = dep.producer;
      const producerFlags = producer.flags;
      
      // Quick check: producer already marked as changed
      if (producerFlags & HAS_CHANGED) {
        // Found change - update current node
        if (isComputed) recomputeNode(node);
        else node.flags = cleanFlags;
        return;
      }
      
      // Skip non-computed producers (signals don't need recursion)
      if ('recompute' in producer && (producerFlags & MASK_STATUS_AWAITING)) {
        pullUpdates(producer);
        
        // Check again after recursion - producer might have changed
        if (producer.flags & HAS_CHANGED) {
          if (isComputed) recomputeNode(node);
          else node.flags = cleanFlags;
          return;
        }
      }
      
      dep = dep.nextDependency;
    }
    
    // No dependencies changed - just mark as clean
    node.flags = cleanFlags;
  };

  return { pullUpdates };
}