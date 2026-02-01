/**
 * Counting Adapter for pure algorithmic benchmarking
 *
 * This adapter has true O(1) operations - it doesn't maintain any data structures,
 * just counts operations. Use this to measure reconciliation algorithm performance
 * without adapter implementation details coloring the results.
 */

import type { Adapter, TreeConfig } from '@rimitive/view/adapter';

/**
 * Minimal node type - just an id for identity
 */
export type CountingNode = {
  id: number;
};

/**
 * Tree config for counting adapter
 */
export type CountingTreeConfig = TreeConfig & {
  attributes: Record<string, Record<string, unknown>>;
  nodes: Record<string, CountingNode> & { text: CountingNode };
};

/**
 * Operation counts
 */
export type OperationCounts = {
  createNode: number;
  setAttribute: number;
  appendChild: number;
  removeChild: number;
  insertBefore: number;
};

/**
 * Counting adapter instance
 */
export type CountingAdapter = Adapter<CountingTreeConfig> & {
  counts: OperationCounts;
  reset(): void;
};

/**
 * Create a counting adapter for benchmarking
 *
 * All operations are O(1) - no data structure maintenance, just counting.
 */
export function createCountingAdapter(): CountingAdapter {
  let nodeId = 0;

  const counts: OperationCounts = {
    createNode: 0,
    setAttribute: 0,
    appendChild: 0,
    removeChild: 0,
    insertBefore: 0,
  };

  return {
    counts,

    createNode: () => {
      counts.createNode++;
      return { id: nodeId++ };
    },

    setAttribute: () => {
      counts.setAttribute++;
    },

    appendChild: () => {
      counts.appendChild++;
    },

    removeChild: () => {
      counts.removeChild++;
    },

    insertBefore: () => {
      counts.insertBefore++;
    },

    reset() {
      counts.createNode = 0;
      counts.setAttribute = 0;
      counts.appendChild = 0;
      counts.removeChild = 0;
      counts.insertBefore = 0;
    },
  };
}

/**
 * Create a root node
 */
export function createCountingRoot(): CountingNode {
  return { id: -1 };
}
