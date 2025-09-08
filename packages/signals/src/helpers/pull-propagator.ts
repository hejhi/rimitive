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
    
    // If no dependencies yet (first run), must recompute
    if (!node.dependencies) {
      recomputeNode(node);
      return;
    }
    
    // Check dependencies recursively
    let shouldRecompute = false;
    let current: Dependency | undefined = node.dependencies;

    while (current) {
      const producer = current.producer;
      const producerFlags = producer.flags;
      
      // If dependency is PENDING, recursively pull it first
      if ('recompute' in producer && (producerFlags & STATUS_PENDING)) {
        pullUpdates(producer);
      }
      
      // After pulling, check if dependency is DIRTY (value changed)
      if (producer.flags & DIRTY) {
        shouldRecompute = true;
        break; // Found a changed dependency, no need to check others
      }

      current = current.nextDependency;
    }
    
    if (shouldRecompute) {
      recomputeNode(node);
    } else {
      // No dependencies changed, just clear PENDING status
      node.flags = flags & ~MASK_STATUS;
    }
  };

  return { pullUpdates };
}