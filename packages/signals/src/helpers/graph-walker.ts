import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode } from '../types';

const { NOTIFIED, DISPOSED, RUNNING } = CONSTANTS;

// OPTIMIZATION: Pre-computed Bitmask
// Combine flags that indicate a node should be skipped during traversal
const SKIP_FLAGS = NOTIFIED | DISPOSED | RUNNING;

// Note: We now use Edge.stackNext for intrusive stack management
// instead of separate TraversalFrame objects to achieve zero allocation

export interface GraphWalker {
  // Default traversal (DFS) used by signals/computeds
  walk: (from: Edge | undefined, visit: (node: ConsumerNode) => void) => void;
  // Depth-first traversal exposed explicitly
  dfs: (from: Edge | undefined, visit: (node: ConsumerNode) => void) => void;
  // Multi-root traversal using intrusive linked list
  dfsMany: (rootsHead: Edge | undefined, visit: (node: ConsumerNode) => void) => void;
}

/**
 * Creates a graph walker for efficient dependency graph traversal.
 *
 * ALGORITHM: Iterative DFS with flag-based short-circuiting
 * - Uses NOTIFIED/DISPOSED/RUNNING flags to avoid redundant work
 * - Relies on NOTIFIED as a per-walk dedup marker (set on first visit)
 */
export function createGraphWalker(): GraphWalker {
  // Depth-first traversal with explicit stack
  const dfs = (
    from: Edge | undefined,
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!from) return;

    // OPTIMIZATION: Fast path for single-edge linear chains
    // Avoid stack allocation for simple cases
    if (!from.nextTarget) {
      let edge: Edge | undefined = from;
      while (edge && !edge.nextTarget) {
        const target = edge.target as ConsumerNode;
        if (target._flags & SKIP_FLAGS) break;

        target._flags |= NOTIFIED;
        visit(target);
        edge = (target as unknown as { _targets?: Edge })._targets;
      }

      // If we broke out with multiple targets, fall through to normal DFS
      if (!edge) return;
      from = edge;
    }

    let stack: Edge | undefined;
    let currentEdge: Edge | undefined = from;

    while (currentEdge) {
      const target = currentEdge.target;

      // Skip nodes already notified/disposed/running
      if (target._flags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextTarget;
        continue;
      }

      // Mark as NOTIFIED (lazy invalidation) and invoke visitor
      target._flags |= NOTIFIED;
      visit(target);

      // Optimized traversal with reduced branching
      const nextSibling = currentEdge.nextTarget;
      const childTargets = (target as unknown as { _targets?: Edge })._targets;

      // Determine next edge to process using intrusive stack
      if (childTargets) {
        // Push sibling to stack if exists, then go to children
        if (nextSibling) {
          nextSibling.stackNext = stack;
          stack = nextSibling;
        }
        currentEdge = childTargets;
      } else if (nextSibling) {
        // No children, process sibling
        currentEdge = nextSibling;
      } else if (stack) {
        // No children or siblings, pop from intrusive stack
        currentEdge = stack;
        stack = stack.stackNext;
        currentEdge.stackNext = undefined; // Clean up
      } else {
        currentEdge = undefined;
      }
    }
  };

  // Depth-first traversal for multiple roots using intrusive list
  const dfsMany = (
    rootsHead: Edge | undefined,
    visit: (node: ConsumerNode) => void
  ): void => {
    let stack: Edge | undefined;
    let currentEdge: Edge | undefined = undefined;
    let rootsQueue: Edge | undefined = rootsHead;

    // Helper to advance to next available edge from stack or roots queue
    const nextEdge = (): Edge | undefined => {
      if (stack) {
        const e = stack;
        stack = stack.stackNext;
        e.stackNext = undefined; // Clean up
        return e;
      }
      // Process next root from intrusive queue
      if (rootsQueue) {
        const candidate = rootsQueue;
        rootsQueue = rootsQueue.queueNext;
        return candidate;
      }
      return undefined;
    };

    currentEdge = nextEdge();
    while (currentEdge) {
      const target = currentEdge.target;

      if (target._flags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextTarget ?? nextEdge();
        continue;
      }

      target._flags |= NOTIFIED;
      visit(target);

      const nextSibling = currentEdge.nextTarget;
      const childTargets = (target as unknown as { _targets?: Edge })._targets;

      if (childTargets) {
        if (nextSibling) {
          nextSibling.stackNext = stack;
          stack = nextSibling;
        }
        currentEdge = childTargets;
        continue;
      }

      if (nextSibling) {
        currentEdge = nextSibling;
        continue;
      }

      currentEdge = nextEdge();
    }
  };



  // Keep DFS as the default walk to preserve existing behavior
  const walk = dfs;
  return { walk, dfs, dfsMany };
}
