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
  // Iterative edge-based traversal using linked-list stack (no arrays)
  const checkDirty = (dep: ToNode['dependencies']): boolean => {
    // Return false if no dependencies
    if (!dep) return false;
    
    // Stack frame for iterative traversal (linked list, not array)
    interface StackFrame {
      dep: NonNullable<typeof dep>;  // The dependency to process after returning
      producer: NonNullable<typeof dep>['producer'];  // The producer we're checking
      prev: StackFrame | undefined;
    }
    
    let stack: StackFrame | undefined = undefined;
    let currentDep = dep;
    let dirty = false;
    
    outer: while (true) {
      // Process current dependency chain
      while (currentDep) {
        const producer = currentDep.producer;
        const producerFlags = producer.flags;
        
        // Check if producer already changed
        if (producerFlags & HAS_CHANGED) {
          dirty = true;
          break outer;
        }
        
        // Check computed producers that need checking
        if ('recompute' in producer && (producerFlags & MASK_STATUS_AWAITING)) {
          // Need to check producer's dependencies
          if (producer.dependencies) {
            // Save our position (push to stack)
            stack = {
              dep: currentDep,
              producer: producer,
              prev: stack
            };
            // Descend into producer's dependencies
            currentDep = producer.dependencies;
            continue;
          } else {
            // No dependencies, mark as clean
            producer.flags &= ~MASK_STATUS;
          }
        }
        
        currentDep = currentDep.nextDependency as typeof dep;
      }
      
      // Pop from stack and handle the result
      if (!stack) break;  // Nothing left to process
      
      const frame: StackFrame = stack;
      stack = frame.prev;
      
      // We've finished checking this producer's dependencies
      // If dirty was set, we would have broken out of outer loop
      // So if we're here, dependencies were clean
      if ('recompute' in frame.producer) {
        frame.producer.flags &= ~MASK_STATUS;  // Mark as clean
      }
      
      // Continue with next dependency
      currentDep = frame.dep.nextDependency as typeof dep;
    }
    
    // If we found dirty, need to recompute producers on the way back up
    if (dirty) {
      while (stack) {
        const frame = stack;
        if ('recompute' in frame.producer && (frame.producer.flags & MASK_STATUS_AWAITING)) {
          recomputeNode(frame.producer);
        }
        stack = frame.prev;
      }
    }
    
    return dirty;
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