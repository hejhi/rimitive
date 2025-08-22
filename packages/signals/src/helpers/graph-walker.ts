import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode, ScheduledNode } from '../types';

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
  // Depth-first traversal exposed explicitly
  dfs: (from: Edge | undefined, visit: (node: ScheduledNode) => void) => void;
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
    visit: (node: ScheduledNode) => void
  ): void => {
    let stackHead: StackedEdge | undefined;
    let currentEdge: Edge | undefined = from;

    while (currentEdge) {
      const target = currentEdge.to;

      if (target._flags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Inline both invalidation and enqueue
      target._flags |= CONSTANTS.INVALIDATED;
      if ('_nextScheduled' in target) {
        visit(target as ScheduledNode);
      }

      const nextSibling = currentEdge.nextOut;
      const childTargets = (target as unknown as { _out?: Edge })._out;

      if (childTargets) {
        if (nextSibling) {
          const sibling = nextSibling as StackedEdge;
          sibling._stackNext = stackHead;
          stackHead = sibling;
        }
        currentEdge = childTargets;
      } else if (nextSibling) {
        currentEdge = nextSibling;
      } else if (stackHead) {
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
        currentEdge = currentEdge.nextOut ?? nextEdge();
        continue;
      }

      target._flags |= INVALIDATED;
      visit(target);

      const nextSibling = currentEdge.nextOut;
      const childTargets = (target as unknown as { _out?: Edge })._out;

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

  return { dfs, dfsMany };
}
