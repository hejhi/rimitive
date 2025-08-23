import { CONSTANTS } from '../constants';
import type { Edge, ScheduledNode } from '../types';

const { INVALIDATED, DISPOSED, RUNNING } = CONSTANTS;

// OPTIMIZATION: Pre-computed Bitmask
// Combine flags that indicate a node should be skipped during traversal
const SKIP_FLAGS = INVALIDATED | DISPOSED | RUNNING;

// Stack node for DFS traversal - follows alien-signals pattern
interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface GraphWalker {
  invalidate: (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ) => void;
}

/**
 * Creates a graph walker for efficient dependency graph traversal.
 */
export function createGraphWalker(): GraphWalker {
  const invalidate = (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ): void => {
    let stack: Stack<Edge> | undefined;
    let currentEdge: Edge | undefined = from;

    if (!currentEdge) return;
    
    do {
      const target = currentEdge.to;
      // Mark this edge as the cause of invalidation for this traversal
      currentEdge.touched = true;

      const targetFlags = target._flags;

      // Skip already processed nodes
      if (targetFlags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Mark as invalidated and schedule if needed
      target._flags = targetFlags | INVALIDATED;

      if ('_out' in target) {
        const nextSibling = currentEdge.nextOut;

        if (nextSibling) stack = { value: nextSibling, prev: stack };

        currentEdge = target._out;

        if (currentEdge) continue;
        if (!stack) break;

        currentEdge = stack.value;
        stack = stack.prev;
        continue;
      }

      if ('_nextScheduled' in target) visit(target as ScheduledNode);
      if (!stack) continue;
      
      currentEdge = stack.value;
      stack = stack.prev;
    } while (currentEdge);
  };

  return { invalidate };
}
