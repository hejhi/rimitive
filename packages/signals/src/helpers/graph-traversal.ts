import { CONSTANTS } from '../constants';
import type { Edge } from '../types';
import type { SignalContext } from '../context';
import type { ScheduledConsumerHelpers } from './scheduled-consumer';

const { NOTIFIED, DISPOSED, RUNNING } = CONSTANTS;

// OPTIMIZATION: Pre-computed Bitmask
// Combine flags that indicate a node should be skipped during traversal
// Using bitwise OR at compile time for faster runtime checks
const SKIP_FLAGS = NOTIFIED | DISPOSED | RUNNING;

// ALGORITHM: Explicit Stack for Iterative DFS
// Instead of using recursion (which can overflow on deep graphs),
// we maintain an explicit stack of traversal frames.
// Each frame represents a position in the graph we need to return to.
interface TraversalFrame {
  edge: Edge; // The edge to process when we return to this frame
  next: TraversalFrame | undefined; // Link to next frame (linked list stack)
}

export interface GraphTraversalHelpers {
  traverseAndInvalidate: (startEdge: Edge | undefined) => void;
}

/**
 * Creates graph traversal helpers for efficient dependency graph updates.
 * 
 * ALGORITHM: Iterative Depth-First Search with Explicit Stack
 * Traditional recursive DFS can cause stack overflow on deep dependency chains.
 * This implementation uses an explicit stack to traverse arbitrarily deep graphs.
 * 
 * INSPIRATION: This approach is similar to alien-signals and other high-performance
 * reactive libraries that prioritize handling deep dependency chains efficiently.
 */
export function createGraphTraversalHelpers(
  ctx: SignalContext,
  { scheduleConsumer }: ScheduledConsumerHelpers
): GraphTraversalHelpers {
  // OPTIMIZATION: Track last traversal version to skip redundant work
  let lastTraversalVersion = -1;
  /**
   * ALGORITHM: Push-Phase Invalidation via Iterative DFS
   * 
   * When a signal changes, we need to invalidate all transitively dependent
   * computeds and effects. This function implements the "push" phase of the
   * push-pull algorithm.
   * 
   * Key insights:
   * 1. We only mark nodes as NOTIFIED (not OUTDATED) for lazy evaluation
   * 2. Effects are scheduled but not executed (deferred until batch end)
   * 3. Already notified nodes are skipped (prevents redundant traversal)
   * 4. Depth-first order ensures proper invalidation ordering
   */
  const traverseAndInvalidate = (startEdge: Edge | undefined): void => {
    if (!startEdge) return;
    
    // OPTIMIZATION: Global Version Fast Path
    // Skip this optimization for now - it can cause correctness issues
    // if not all paths were traversed in the first pass
    
    // Update tracking for this version
    if (lastTraversalVersion !== ctx.version) {
      lastTraversalVersion = ctx.version;
    }

    // ALGORITHM: Iterative DFS State
    // - stack: Linked list of positions to return to (simulates call stack)
    // - currentEdge: Current position in graph traversal
    let stack: TraversalFrame | undefined;
    let currentEdge: Edge | undefined = startEdge;

    // Main traversal loop - continues until all reachable nodes are processed
    while (currentEdge) {
      const target = currentEdge.target;
      
      // OPTIMIZATION: Early Skip Check
      // Skip nodes that are already processed or invalid
      if (target._flags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextTarget;
        continue;
      }
      
      // Mark as notified and schedule if needed
      target._flags |= NOTIFIED;
      
      if ('_nextScheduled' in target) scheduleConsumer(target);
      
      // OPTIMIZATION: Linear Chain Fast Path
      // Most dependency chains are linear (A→B→C). Handle these without stack.
      const nextSibling = currentEdge.nextTarget;
      const childTargets = '_targets' in target ? target._targets : undefined;
      
      if (childTargets) {
        // Has children to traverse
        // Save sibling for later (need stack)
        if (nextSibling) {
          stack = { edge: nextSibling, next: stack };
        }

        currentEdge = childTargets;
        continue;
      }
      
      if (nextSibling) {
        // No children, but has siblings
        currentEdge = nextSibling;
        continue;
      }

      // No children or siblings - backtrack
      currentEdge = stack?.edge;
      stack = stack?.next;
    }
  }

  return { traverseAndInvalidate };
}