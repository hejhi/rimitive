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
    walker: GraphWalker,
    visit: (node: ConsumerNode) => void
  ) => void;
}

/**
 * ALGORITHM: Multi-root Invalidation Aggregator
 *
 * Collects starting edges across multiple writes within a batch and performs
 * a single traversal using the GraphWalker. This reduces redundant work when
 * several producers change before effects are flushed.
 */
export function createPropagator(): Propagator {
  let roots: Edge[] = [];

  const add = (from: Edge | undefined): void => {
    if (!from) return;
    roots.push(from);
  };

  const clear = (): void => {
    // Reuse the array to avoid allocations per batch
    roots.length = 0;
  };

  const size = (): number => roots.length;

  const propagate = (
    walker: GraphWalker,
    visit: (node: ConsumerNode) => void
  ): void => {
    if (roots.length === 0) return;
    walker.dfsMany(roots, visit);
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
    // Small-batch fast path to avoid array churn
    if (roots.length < 2) {
      walker.dfs(from, visit);
      return;
    }
    roots.push(from);
  };

  return { add, clear, size, propagate, invalidate };
}
