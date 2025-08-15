import type { Edge, ConsumerNode } from '../types';
import type { GraphWalker, QueuedEdge } from './graph-walker';

export interface Propagator {
  add: (from: Edge | undefined) => void;
  clear: () => void;
  size: () => number;
  // Invalidate immediately or aggregate based on batching/threshold
  invalidate: (
    from: Edge | undefined,
    isBatched: boolean,
    walker: GraphWalker['dfs'],
    visit: (node: ConsumerNode) => void
  ) => void;
  // Run a single traversal seeded by all added roots
  propagate: (
    dfsMany: GraphWalker['dfsMany'],
    visit: (node: ConsumerNode) => void
  ) => void;
}

/**
 * ALGORITHM: Zero-Allocation Multi-root Invalidation Aggregator
 *
 * Collects starting edges across multiple writes within a batch and performs
 * a single traversal using the GraphWalker. Uses intrusive linked lists
 * instead of arrays to achieve true zero-allocation operation.
 */
export function createPropagator(): Propagator {
  // OPTIMIZATION: Intrusive queue - edges themselves form the linked list
  // No separate QueueNode allocations, no Set allocation
  let rootsHead: QueuedEdge | undefined;
  let rootsTail: QueuedEdge | undefined;
  let rootsSize = 0;

  const add = (from: Edge | undefined): void => {
    if (!from) return;
    
    const edge = from as QueuedEdge;
    
    // OPTIMIZATION: Use flag instead of Set for deduplication
    if (edge._queued) return; // Already queued
    edge._queued = true;
    
    // Add to intrusive queue (no allocation)
    edge._queueNext = undefined;
    
    if (rootsTail) {
      rootsTail._queueNext = edge;
      rootsTail = edge;
    } else {
      rootsHead = rootsTail = edge;
    }
    rootsSize++;
  };

  const clear = (): void => {
    // Clear queue and reset flags
    let current = rootsHead;
    while (current) {
      current._queued = false; // Reset flag
      const next = current._queueNext;
      current._queueNext = undefined; // Clean up reference
      current = next;
    }
    rootsHead = rootsTail = undefined;
    rootsSize = 0;
  };

  const size = (): number => rootsSize;

  const propagate = (
    dfsMany: GraphWalker['dfsMany'],
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!rootsHead) return;
    
    // Pass intrusive queue directly to walker - zero allocations!
    dfsMany(rootsHead, visit);
    clear();
  };

  // OPTIMIZATION: Centralized invalidation strategy
  // - Outside batches: traverse immediately
  // - Inside small batches: traverse immediately (threshold tuned to 2)
  // - Large batches: aggregate for a single multi-root traversal at commit
  const invalidate = (
    from: Edge | undefined,
    isBatched: boolean,
    dfs: GraphWalker['dfs'],
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!from) return;

    if (!isBatched) {
      dfs(from, visit);
      return;
    }

    // Small-batch fast path to avoid queue overhead
    if (rootsSize < 2) {
      dfs(from, visit);
      return;
    }

    add(from);
  };

  return { add, clear, size, propagate, invalidate };
}
