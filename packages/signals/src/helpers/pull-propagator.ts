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
    if (!dep) return false;
    
    interface Frame { 
      dep: NonNullable<typeof dep>; 
      producer: NonNullable<typeof dep>['producer']; 
      prev: Frame | undefined; 
    }
    
    let stack: Frame | undefined;
    let current = dep;
    
    // Hot path optimizations:
    // - Minimize branches by combining conditions
    // - Use direct property access where safe
    // - Inline common operations
    while (true) {
      while (current) {
        const producer = current.producer;
        const flags = producer.flags;
        
        // Combined check: dirty OR computed needing validation
        if (flags & (HAS_CHANGED | MASK_STATUS_AWAITING)) {
          if (flags & HAS_CHANGED) {
            // Found dirty - recompute stack and exit
            for (let s = stack; s; s = s.prev) {
              const p = s.producer;
              if ('recompute' in p && (p.flags & MASK_STATUS_AWAITING)) {
                recomputeNode(p);
              }
            }
            return true;
          }
          
          // Must be computed awaiting validation
          if ('recompute' in producer) {
            const subDeps = producer.dependencies;
            if (subDeps) {
              stack = { dep: current, producer, prev: stack };
              current = subDeps;
              continue;
            }
            // Leaf computed - mark clean
            producer.flags = flags & ~MASK_STATUS;
          }
        }
        
        current = current.nextDependency as typeof dep;
      }
      
      if (!stack) return false;
      
      // Mark producer clean and continue
      const frame = stack;
      if ('recompute' in frame.producer) {
        frame.producer.flags &= ~MASK_STATUS;
      }
      
      current = frame.dep.nextDependency as typeof dep;
      stack = frame.prev;
    }
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