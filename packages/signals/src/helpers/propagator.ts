import type { Edge, ConsumerNode } from '../types';
import type { GraphWalker } from './graph-walker';

export interface Propagator {
  add: (from: Edge | undefined) => void;
  clear: () => void;
  size: () => number;
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

  return { add, clear, size, propagate };
}
