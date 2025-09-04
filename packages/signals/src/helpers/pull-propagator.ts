import type { ToNode } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const {
  STATUS_PENDING,
  STATUS_DIRTY,
  STATUS_DISPOSED,
  HAS_CHANGED,
  MASK_STATUS,
} = CONSTANTS;


export interface PullPropagator {
  pullUpdates: (node: ToNode) => void;
}

const { recomputeNode } = createNodeState();

export function createPullPropagator(): PullPropagator {
  const pullUpdates = (node: ToNode): void => {
    const flags = node.flags;
    
    // Quick exit for clean, disposed, or null nodes
    if (!(flags & (STATUS_PENDING | STATUS_DIRTY)) || (flags & STATUS_DISPOSED)) {
      return;
    }
    
    // Fast path: already dirty, just recompute directly
    if (flags & STATUS_DIRTY) {
      if ('recompute' in node) {
        recomputeNode(node, flags);
      } else {
        node.flags = flags & ~MASK_STATUS; // Clear status (set to CLEAN)
      }
      return;
    }
    
    // Pending state: need to check dependencies
    const isDerivedNode = 'recompute' in node;
    let needsUpdate = false;
    let dep = node.dependencies;
    
    // Walk dependency chain to check for changes
    while (dep && !needsUpdate) {
      const producer = dep.producer;
      const producerFlags = producer.flags;
      
      // Early exit if producer already changed
      if (producerFlags & HAS_CHANGED) {
        needsUpdate = true;
        break;
      }
      
      // Skip non-computed producers (signals)
      if (!('recompute' in producer)) {
        dep = dep.nextDependency;
        continue;
      }
      
      // Recursively check computed producers
      if (producerFlags & STATUS_PENDING) {
        pullUpdates(producer); // Recursive check
        
        // After recursive check, see if it changed
        if (producer.flags & HAS_CHANGED) {
          needsUpdate = true;
          break;
        }
      } else if (producerFlags & STATUS_DIRTY) {
        // Producer is dirty, recompute it
        const changed = recomputeNode(producer, producerFlags);
        if (changed) {
          needsUpdate = true;
          break;
        }
      }
      
      dep = dep.nextDependency;
    }
    
    // Update current node based on dependency check result
    if (needsUpdate && isDerivedNode) {
      recomputeNode(node, node.flags);
    } else {
      node.flags = node.flags & ~MASK_STATUS; // Clear status (set to CLEAN)
    }
  };

  return { pullUpdates };
}