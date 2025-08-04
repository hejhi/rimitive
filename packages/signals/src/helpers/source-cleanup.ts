// ALGORITHM: Dynamic Dependency Management
//
// These helpers manage the cleanup of dependency edges when:
// 1. A computed/effect is disposed (remove all edges)
// 2. Dependencies change between runs (remove stale edges)
//
// This is crucial for:
// - Preventing memory leaks (circular references)
// - Ensuring computeds/effects don't react to old dependencies
// - Supporting conditional dependency patterns
import type { ConsumerNode, Edge } from '../types';
import { createDependencyHelpers } from './dependency-tracking';

export function createSourceCleanupHelpers({ removeFromTargets }: ReturnType<typeof createDependencyHelpers>) {
  // ALGORITHM: Complete Edge Removal
  // Used during disposal to remove all dependency edges at once
  const disposeAllSources = (consumer: ConsumerNode): void => {
    let node = consumer._sources;
    
    // Walk the linked list of sources
    while (node) {
      // Save next pointer before removal (removal might clear it)
      const next = node.nextSource;
      
      // Remove this edge from the producer's target list
      // This is the bidirectional edge removal - we remove from both sides
      removeFromTargets(node);
      
      // Move to next source
      node = next;
    }
    
    // Clear the consumer's source list head
    consumer._sources = undefined;
  };

  // ALGORITHM: Selective Edge Removal for Dynamic Dependencies
  // After a computed/effect runs, we need to remove edges to dependencies
  // that were NOT accessed during the run (marked with version -1)
  const cleanupSources = (consumer: ConsumerNode): void => {
    let node = consumer._sources;
    let prev: Edge | undefined;

    // Walk the linked list, removing nodes with version -1
    while (node !== undefined) {
      const next = node.nextSource;

      if (node.version === -1) {
        // ALGORITHM: Linked List Removal
        // This dependency wasn't accessed - remove it
        
        // Update previous node's forward pointer
        if (prev !== undefined) {
          prev.nextSource = next;
        } else {
          // No previous - update head pointer
          consumer._sources = next;
        }

        // Update next node's backward pointer
        if (next !== undefined) (next.prevSource = prev);

        // Remove from producer's target list (bidirectional removal)
        removeFromTargets(node);
        
        // Don't update prev - it stays the same for next iteration
      } else {
        // This dependency was accessed - keep it
        // Update prev for next iteration
        prev = node;
      }

      node = next;
    }
  };

  return { disposeAllSources, cleanupSources };
}