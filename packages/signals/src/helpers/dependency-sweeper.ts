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
  unlinkFromProducer: (edge: Edge) => void,
): DependencySweeper {
  // ALGORITHM: Complete Edge Removal
  // Used during disposal to remove all dependency edges at once
  const detachAll = (consumer: ConsumerNode): void => {
    let node = consumer._sources;
    
    // Walk the linked list of sources
    while (node) {
      // Save next pointer before removal (removal might clear it)
      const next = node.nextSource;
      
      // Remove this edge from the producer's target list
      // This is the bidirectional edge removal - we remove from both sides
      unlinkFromProducer(node);
      
      // No need to clear producer cache or WeakMap here:
      // - Consumer is being disposed and will be GC'd
      // - WeakMap entries disappear automatically with GC
      // - No future ensureLink calls will happen for this consumer
      
      // Move to next source
      node = next;
    }
    
    // Clear the consumer's source list head
    consumer._sources = undefined;
  };

  // ALGORITHM: Edge Recycling via Version Marking
  // After a computed/effect runs, mark edges whose generation tag does not
  // match the consumer's current generation as recyclable (version = -1).
  // This avoids constant allocation/deallocation of Edge objects.
  const pruneStale = (consumer: ConsumerNode): void => {
    let node = consumer._sources;

    const currentGen = consumer._runVersion;
    // Walk the linked list, marking stale nodes as recyclable
    while (node !== undefined) {
      if (node.runVersion !== currentGen) {
        // Mark edge as recyclable instead of removing it
        // version = -1 indicates a stale edge that can be reused
        node.version = -1;

        // Clear producer's cache if it points to this recycled edge
        // This prevents stale cache hits when the dependency is re-established
        if ('_lastEdge' in node.from && node.from._lastEdge === node) {
          node.from._lastEdge = undefined;
        }

        // DON'T remove from producer's target list - keep for recycling
        // The edge stays in both lists but is marked as inactive
      }
      
      node = node.nextSource;
    }
  };

  return { detachAll, pruneStale };
}
