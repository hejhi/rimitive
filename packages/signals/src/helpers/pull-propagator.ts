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
  const checkDirty = (dep: ToNode['dependencies']): boolean => {
    let current: ToNode['dependencies'] = dep;

    while (current) {
      const producer = current.producer;
      const flags = producer.flags;
      
      if (flags & HAS_CHANGED) return true;
      
      current = current.nextDependency;
    }

    return false;
  };

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

    const dep = node.dependencies;
    
    // Pending path: check dependencies for changes using edge-based traversal
    if (dep && checkDirty(node.dependencies)) {
      // Found change - update current node
      if (isComputed) recomputeNode(node);
      else node.flags = cleanFlags;
      return;
    }
    
    // No dependencies changed - just mark as clean
    node.flags = cleanFlags;
  };

  return { pullUpdates };
}