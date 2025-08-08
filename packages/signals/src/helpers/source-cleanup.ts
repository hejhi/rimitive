/**
 * ALGORITHM: Dynamic Dependency Management and Memory Safety
 * 
 * This module implements the cleanup phase of dynamic dependency tracking.
 * It's essential for correctness and memory efficiency.
 * 
 * KEY ALGORITHMS:
 * 
 * 1. MARK-AND-SWEEP FOR DEPENDENCIES:
 *    - Before recomputation: Mark all dependencies with version -1
 *    - During recomputation: Update version of accessed dependencies
 *    - After recomputation: Remove edges still marked with -1
 *    - Similar to garbage collection algorithms
 * 
 * 2. BIDIRECTIONAL EDGE REMOVAL:
 *    - Each edge must be removed from BOTH linked lists:
 *      a) Consumer's source list (backward edges)
 *      b) Producer's target list (forward edges)
 *    - Prevents dangling pointers and ensures consistency
 * 
 * 3. CONDITIONAL DEPENDENCY SUPPORT:
 *    ```
 *    computed(() => {
 *      if (showDetails.value) {
 *        return `${name.value}: ${description.value}`;
 *      }
 *      return name.value;
 *    })
 *    ```
 *    - When showDetails is false, edge to description is removed
 *    - When showDetails becomes true, edge to description is added
 *    - This automatic management is key to the reactive model
 * 
 * MEMORY SAFETY:
 * - Prevents circular reference leaks between producers/consumers
 * - Ensures disposed nodes can be garbage collected
 * - Critical for long-running applications
 * 
 * INSPIRATION:
 * - Mark-and-sweep garbage collectors
 * - Database referential integrity
 * - Graph theory edge removal algorithms
 */
import type { ConsumerNode, Edge } from '../types';

export interface SourceCleanupHelpers {
  disposeAllSources: (consumer: ConsumerNode) => void;
  cleanupSources: (consumer: ConsumerNode) => void;
}

export function createSourceCleanup(removeFromTargets: (edge: Edge) => void): SourceCleanupHelpers {
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
  // that were NOT accessed during the run (generation != consumer's generation)
  const cleanupSources = (consumer: ConsumerNode): void => {
    let node = consumer._sources;
    let prev: Edge | undefined;

    // Walk the linked list, removing nodes with old generation
    while (node !== undefined) {
      const next = node.nextSource;

      if (node.generation !== consumer._generation) {
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
