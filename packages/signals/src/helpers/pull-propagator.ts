import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_DISPOSED, MASK_STATUS, STATUS_PENDING, DIRTY } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

export function createPullPropagator(ctx: GlobalContext & { graphEdges: GraphEdges }): PullPropagator {
  const { startTracking, endTracking } = ctx.graphEdges;

  // Inline recomputation logic here since we have access to context
  const recomputeNode = (node: DerivedNode): boolean => {
    const prevConsumer = startTracking(ctx, node);
    let valueChanged = false;

    try {
      const oldValue = node.value;
      const newValue = node.compute();

      // Update value and return whether it changed
      if (newValue !== oldValue) {
        node.value = newValue;
        node.lastChangedVersion = ctx.trackingVersion;
        valueChanged = true;
      }
    } finally {
      // Mark as computed in this tracking cycle
      node.lastComputedVersion = ctx.trackingVersion;
      
      // End tracking, restore context, and prune stale dependencies
      endTracking(ctx, node, prevConsumer);
    }
    
    // Set DIRTY property if changed, clear if not changed
    if (valueChanged) {
      node.flags = (node.flags & ~MASK_STATUS) | DIRTY;
    } else {
      // Clear both status AND DIRTY flag when value doesn't change
      node.flags = node.flags & ~(MASK_STATUS | DIRTY);
    }
    
    return valueChanged;
  };

  const pullUpdates = (node: DerivedNode): void => {
    const flags = node.flags;
    
    // Fast path: disposed or already clean
    if (flags & STATUS_DISPOSED || !(flags & STATUS_PENDING)) return;
    
    // If no dependencies yet (first run), must recompute
    if (!node.dependencies) {
      recomputeNode(node);
      return;
    }

    let current: Dependency | undefined = node.dependencies;

    while (current) {
      const producer = current.producer;
      const producerFlags = producer.flags;
      
      // For signals: check DIRTY flag (set on write, cleared on read)
      if (producerFlags & DIRTY) {
        recomputeNode(node);
        return;
      }
      
      // For computeds: check version (only computeds have meaningful versions)
      if ('compute' in producer) {
        // If already computed this cycle and changed after we last computed
        if (producer.lastChangedVersion > node.lastComputedVersion) {
          recomputeNode(node);
          return;
        }
        
        // If PENDING, we need to pull it to know if it changed
        if (producerFlags & STATUS_PENDING) {
          pullUpdates(producer);
          
          // After pulling, check if value changed via DIRTY flag
          // DIRTY will be set if the computed's value changed during recomputation
          if (producer.flags & DIRTY) {
            recomputeNode(node);
            return;
          }
        }
      }

      current = current.nextDependency;
    }
    
    // No dependencies changed, just clear PENDING status
    node.flags = flags & ~MASK_STATUS;
  };

  return { pullUpdates };
}