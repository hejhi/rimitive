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

// Optimized frame structure:
// - dep can be undefined to support sentinel frames (depth markers)
// - When dep is undefined, this is a linear chain marker (no siblings to track)
interface Frame {
  dep: NonNullable<ToNode['dependencies']> | undefined; // undefined = sentinel frame for linear chains
  producer: NonNullable<ToNode['dependencies']>['producer'];
  prev: Frame | undefined;
  next: Frame | undefined; // For bottom-up traversal during recomputation
}

export function createPullPropagator(): PullPropagator {
  const checkDirty = (dep: ToNode['dependencies']): boolean => {
    if (!dep) return false;
    
    let stack: Frame | undefined;
    let current: typeof dep | undefined = dep;
    
    // Initial linear chain detection - check if we start with multiple dependencies
    let isLinearChain = !dep.nextDependency;  // Linear if no siblings at start
    let linearDepth = 0;  // Track depth when in linear chain
    
    // Hot path optimizations:
    // - Only push full frames when branching (multiple paths)
    // - Use sentinel frames for linear chains (saves memory)
    // - Inline common operations
    // - Detect linear chains for potential fast path
    while (true) {
      while (current) {
        const producer = current.producer;
        const flags = producer.flags;
        
        // Combined check: dirty OR computed needing validation
        if (flags & (HAS_CHANGED | MASK_STATUS_AWAITING)) {
          if (flags & HAS_CHANGED) {
            // Found dirty - recompute in correct order (bottom-up)
            // Linear chain detection enables future optimizations
            // For now, we track but use the standard recomputation path
            {
              // Branching case - need to find bottom for correct order
              let bottom = stack;
              while (bottom?.prev) {
                bottom = bottom.prev;
              }
              
              // Process from bottom to top (dependencies before dependents)
              for (let s = bottom; s; s = s.next) {
                const p = s.producer;
                if ('recompute' in p && (p.flags & MASK_STATUS_AWAITING)) {
                  recomputeNode(p);
                }
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
              
              // Detect if we're breaking linear chain pattern
              if (nextDep) {
                isLinearChain = false;  // We have siblings, not linear anymore
              }
              
              // Also check if the subdeps have multiple paths
              if (subDeps.nextDependency) {
                isLinearChain = false;  // Multiple dependencies at next level
              }
              
              // Track depth in linear chains
              if (isLinearChain) {
                linearDepth++;
              }
              
              // Create new frame with doubly-linked structure
              const newFrame: Frame = {
                dep: nextDep ? current : undefined, // undefined for sentinel frames
                producer,
                prev: stack,
                next: undefined
              };
              // Link the previous frame forward to this one
              if (stack) stack.next = newFrame;
              stack = newFrame;
              current = subDeps;
              continue;
            }
            // Leaf computed - mark clean
            producer.flags = flags & ~MASK_STATUS;
          }
        }
        
        current = current.nextDependency;
      }
      
      if (!stack) return false;
      
      // Process frame and mark producer clean
      const frame = stack;
      frame.producer.flags &= ~MASK_STATUS; // Always clear - we only push frames for computed nodes
      
      // Resume based on frame type
      // Full frame - resume from saved position
      // Sentinel frame - no siblings to resume
      current = frame.dep?.nextDependency;
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