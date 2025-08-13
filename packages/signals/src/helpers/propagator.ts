import type { Edge, ConsumerNode } from '../types';
import type { GraphWalker } from './graph-walker';

export interface Propagator {
  add: (from: Edge | undefined) => void;
  clear: () => void;
  size: () => number;
  // Invalidate immediately or aggregate based on batching/threshold
  invalidate: (
    from: Edge | undefined,
    isBatched: boolean,
    walker: GraphWalker,
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
  // Intrusive linked list of pending roots
  let rootsHead: Edge | undefined;
  let rootsTail: Edge | undefined;
  let rootsSize = 0;

  const add = (from: Edge | undefined): void => {
    if (!from || from.queueNext !== undefined) return; // Already queued
    
    // Add to intrusive queue
    from.queueNext = from; // Sentinel value marks as queued
    if (rootsTail) {
      rootsTail.queueNext = from;
      rootsTail = from;
    } else {
      rootsHead = rootsTail = from;
    }
    rootsSize++;
  };

  const clear = (): void => {
    // Clear intrusive list
    let current = rootsHead;
    while (current) {
      const next = current.queueNext === current ? undefined : current.queueNext;
      current.queueNext = undefined;
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
    
    // Pass the intrusive list directly to walker
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
    walker: GraphWalker,
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!from) return;

    if (!isBatched) {
      walker.dfs(from, visit);
      return;
    }

    // Small-batch fast path to avoid queue overhead
    if (rootsSize < 2) {
      walker.dfs(from, visit);
      return;
    }

    add(from);
  };

  return { add, clear, size, propagate, invalidate };
}
