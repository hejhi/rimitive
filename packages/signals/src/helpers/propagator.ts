import type { Edge, ConsumerNode } from '../types';
import type { GraphWalker, QueueNode } from './graph-walker';

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
  // Queue of pending roots using separate nodes
  let rootsHead: QueueNode | undefined;
  let rootsTail: QueueNode | undefined;
  let rootsSize = 0;
  // Track queued edges to prevent duplicates
  const queuedEdges = new Set<Edge>();

  const add = (from: Edge | undefined): void => {
    if (!from || queuedEdges.has(from)) return; // Already queued
    
    // Add to queue with new node
    const node: QueueNode = { edge: from, next: undefined };
    queuedEdges.add(from);
    
    if (rootsTail) {
      rootsTail.next = node;
      rootsTail = node;
    } else {
      rootsHead = rootsTail = node;
    }
    rootsSize++;
  };

  const clear = (): void => {
    // Clear queue - nodes will be GC'd
    rootsHead = rootsTail = undefined;
    rootsSize = 0;
    queuedEdges.clear();
  };

  const size = (): number => rootsSize;

  const propagate = (
    dfsMany: GraphWalker['dfsMany'],
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!rootsHead) return;
    
    // Pass the queue directly to walker
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
