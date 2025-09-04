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
  // Edge-based traversal function for better performance on deep chains
  const checkDirty = (dep: ToNode['dependencies']): boolean => {
    // Return false if no dependencies
    if (!dep) return false;
    
    while (dep) {
      const producer = dep.producer;
      const producerFlags = producer.flags;
      
      // Check if producer already changed
      if (producerFlags & HAS_CHANGED) {
        return true;
      }
      
      // Recursively check computed producers
      if ('recompute' in producer && (producerFlags & MASK_STATUS_AWAITING)) {
        // KEY: Pass producer.dependencies directly (edge-based)
        if (checkDirty(producer.dependencies)) {
          // Bottom-up optimization: recompute producer immediately after its dependencies are resolved
          recomputeNode(producer);
          return true;
        }
        
        // Producer's dependencies weren't dirty, mark it clean
        producer.flags &= ~MASK_STATUS;
        
        // Re-check after recursive call and potential recomputation
        if (producer.flags & HAS_CHANGED) {
          return true;
        }
      }
      
      dep = dep.nextDependency;
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
    
    // Pending path: check dependencies for changes using edge-based traversal
    if (checkDirty(node.dependencies)) {
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