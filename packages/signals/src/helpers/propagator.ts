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

  // V8 OPTIMIZATION: Fast queue addition with minimal branching
  const add = (from: Edge | undefined): void => {
    if (!from) return;
    
    const edge = from as QueuedEdge;
    
    // V8 OPTIMIZATION: Early return for already queued edges
    if (edge._queued) return;
    
    // V8 OPTIMIZATION: Batch property updates for better cache locality
    edge._queued = true;
    edge._queueNext = undefined;
    
    // V8 OPTIMIZATION: Predictable branching pattern
    if (rootsTail) {
      rootsTail._queueNext = edge;
    } else {
      rootsHead = edge;
    }
    rootsTail = edge;
    rootsSize++;
  };

  // V8 OPTIMIZATION: Fast queue clearing with minimal overhead
  const clear = (): void => {
    let current = rootsHead;
    
    // Handle remaining items in loop
    while (current) {
      current._queued = false;
      const next = current._queueNext;
      current._queueNext = undefined;
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

  // V8 OPTIMIZATION: Streamlined invalidation with predictable branches
  const invalidate = (
    from: Edge | undefined,
    isBatched: boolean,
    dfs: GraphWalker['dfs'],
    visit: (node: ConsumerNode) => void
  ): void => {
    if (!from) return;

    // V8 OPTIMIZATION: Branch prediction favors the batch case in typical apps
    if (isBatched) {
      add(from);
    } else {
      dfs(from, visit);
    }
  };

  return { add, clear, size, propagate, invalidate };
}
