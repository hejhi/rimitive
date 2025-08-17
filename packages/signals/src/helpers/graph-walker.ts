import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode } from '../types';

const { INVALIDATED, DISPOSED, RUNNING } = CONSTANTS;

// OPTIMIZATION: Pre-computed Bitmask
// Combine flags that indicate a node should be skipped during traversal
const SKIP_FLAGS = INVALIDATED | DISPOSED | RUNNING;

// Intrusive stack for DFS traversal - zero allocations
// Edge extends with _stackNext pointer for stack operations
export interface StackedEdge extends Edge {
  _stackNext?: StackedEdge;
}

// Queue node for multiple roots - uses intrusive queue pattern
// QueuedEdge extends Edge with _queueNext pointer for zero-allocation queuing
export interface QueuedEdge extends Edge {
  _queueNext?: QueuedEdge;
  _queued?: boolean;
}

export interface GraphWalker {
  // Default traversal (DFS) used by signals/computeds
  walk: (from: Edge | undefined, visit: (node: ConsumerNode) => void) => void;
  // Depth-first traversal exposed explicitly
  dfs: (from: Edge | undefined, visit: (node: ConsumerNode) => void) => void;
  // Multi-root traversal using intrusive queue
  dfsMany: (rootsHead: QueuedEdge | undefined, visit: (node: ConsumerNode) => void) => void;
}

/**
 * Creates a graph walker for efficient dependency graph traversal.
 *
 * ALGORITHM: Iterative DFS with flag-based short-circuiting
 * - Uses INVALIDATED/DISPOSED/RUNNING flags to avoid redundant work
 * - Relies on INVALIDATED as a per-walk dedup marker (set on first visit)
 */
export function createGraphWalker(): GraphWalker {
  // Depth-first traversal with intrusive stack (zero allocations)
  const dfs = (
    from: Edge | undefined,
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!from) return;

    // OPTIMIZATION: Fast path for single-edge linear chains
    // Avoid stack operations for simple cases
    if (!from.nextTo) {
      let edge: Edge | undefined = from;
      while (edge && !edge.nextTo) {
        const to = edge.to as ConsumerNode;
        if (to._flags & SKIP_FLAGS) break;

        to._flags |= INVALIDATED;
        visit(to);
        edge = (to as unknown as { _to?: Edge })._to;
      }

      // If we broke out with multiple targets, fall through to normal DFS
      if (!edge) return;
      from = edge;
    }

    let stackHead: StackedEdge | undefined;
    let currentEdge: Edge | undefined = from;

    while (currentEdge) {
      const target = currentEdge.to;

      // Skip nodes already notified/disposed/running
      if (target._flags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextTo;
        continue;
      }

      // Mark as INVALIDATED (lazy invalidation) and invoke visitor
      target._flags |= INVALIDATED;
      visit(target);

      // Optimized traversal with reduced branching
      const nextSibling = currentEdge.nextTo;
      const childTargets = (target as unknown as { _to?: Edge })._to;

      // Determine next edge to process using intrusive stack
      if (childTargets) {
        // Push sibling to stack if exists, then go to children
        if (nextSibling) {
          const sibling = nextSibling as StackedEdge;
          sibling._stackNext = stackHead;
          stackHead = sibling;
        }
        currentEdge = childTargets;
      } else if (nextSibling) {
        // No children, process sibling
        currentEdge = nextSibling;
      } else if (stackHead) {
        // No children or siblings, pop from stack
        currentEdge = stackHead;
        stackHead = stackHead._stackNext;
      } else {
        currentEdge = undefined;
      }
    }
  };

  // Depth-first traversal for multiple roots using intrusive queue and stack
  const dfsMany = (
    rootsHead: QueuedEdge | undefined,
    visit: (node: ConsumerNode) => void
  ): void => {
    let stackHead: StackedEdge | undefined;
    let currentEdge: Edge | undefined = undefined;
    let rootsQueue: QueuedEdge | undefined = rootsHead;

    // Helper to advance to next available edge from stack or roots queue
    const nextEdge = (): Edge | undefined => {
      if (stackHead) {
        const edge = stackHead;
        stackHead = stackHead._stackNext;
        return edge;
      }
      // Process next root from intrusive queue
      if (rootsQueue) {
        const edge = rootsQueue;
        rootsQueue = rootsQueue._queueNext;  // Use intrusive pointer
        return edge;
      }
      return undefined;
    };

    currentEdge = nextEdge();
    while (currentEdge) {
      const target = currentEdge.to;

      if (target._flags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextTo ?? nextEdge();
        continue;
      }

      target._flags |= INVALIDATED;
      visit(target);

      const nextSibling = currentEdge.nextTo;
      const childTargets = (target as unknown as { _to?: Edge })._to;

      if (childTargets) {
        if (nextSibling) {
          const sibling = nextSibling as StackedEdge;
          sibling._stackNext = stackHead;
          stackHead = sibling;
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
