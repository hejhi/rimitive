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

export interface DependencySweeper {
  detachAll: (consumer: ConsumerNode) => void;
  pruneStale: (consumer: ConsumerNode) => void;
}

export function createDependencySweeper(
  unlink: (edge: Edge) => Edge | undefined,
): DependencySweeper {
  // ALGORITHM: Complete Edge Removal
  // Used during disposal to remove all dependency edges at once
  const detachAll = (consumer: ConsumerNode): void => {
    let node = consumer._in;
    
    // Walk the linked list of sources
    while (node) {
      // unlink returns the next edge, so we can iterate efficiently
      node = unlink(node);
    }
    
    // Clear the consumer's source list head and tail
    consumer._in = undefined;
    consumer._inTail = undefined;
  };

  // ALGORITHM: Tail-based Edge Removal (alien-signals approach)
  // After a computed/effect runs, remove all edges after the tail marker.
  // The tail was set at the start of the run, and all valid dependencies
  // were moved to/before the tail during the run.
  const pruneStale = (consumer: ConsumerNode): void => {
    const tail = consumer._inTail;
    
    // If no tail, all edges should be removed
    let toRemove = tail ? tail.nextIn : consumer._in;
    
    // Remove all edges after the tail
    while (toRemove) {
      // Clear producer's cache if it points to this edge
      if ('_lastEdge' in toRemove.from && toRemove.from._lastEdge === toRemove) {
        toRemove.from._lastEdge = undefined;
      }
      
      // unlink handles both sides and returns next edge
      toRemove = unlink(toRemove);
    }
    
    // Update tail to point to the last valid edge
    if (tail) {
      tail.nextIn = undefined;
    }
  };

  return { detachAll, pruneStale };
}
