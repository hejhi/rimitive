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
    
    // Optimized frame structure:
    // - dep is nullable to support sentinel frames (depth markers)
    // - When dep is null, this is a linear chain marker (no siblings to track)
    interface Frame { 
      dep: NonNullable<typeof dep> | null;  // null = sentinel frame for linear chains
      producer: NonNullable<typeof dep>['producer']; 
      prev: Frame | undefined; 
    }
    
    let stack: Frame | undefined;
    let current: typeof dep | null = dep;
    
    // Hot path optimizations:
    // - Only push full frames when branching (multiple paths)
    // - Use sentinel frames for linear chains (saves memory)
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
              // Key optimization: only push full frame if there are siblings
              const nextDep = current.nextDependency;
              if (nextDep) {
                // Multiple paths - need full bookmark
                stack = { dep: current, producer, prev: stack };
              } else {
                // Linear chain - just mark depth with sentinel
                stack = { dep: null, producer, prev: stack };
              }
              current = subDeps;
              continue;
            }
            // Leaf computed - mark clean
            producer.flags = flags & ~MASK_STATUS;
          }
        }
        
        current = current.nextDependency as typeof dep | null;
      }
      
      if (!stack) return false;
      
      // Process frame based on type
      const frame = stack;
      if ('recompute' in frame.producer) {
        frame.producer.flags &= ~MASK_STATUS;
      }
      
      // Resume based on frame type
      if (frame.dep) {
        // Full frame - resume from saved position
        current = frame.dep.nextDependency as typeof dep | null;
      } else {
        // Sentinel frame - no siblings to resume, will exit on next iteration
        current = null;
      }
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