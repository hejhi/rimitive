/**
 * RefSpec-based reconciliation for reactive arrays
 *
 * This provides reconciliation utilities that work with RefSpecs (with keys)
 * instead of being tied to fragment implementations. Enables user-space
 * reactive helpers using the closure pattern.
 */

import type { ElementRef } from '../types';

// Status bits for reconciliation (separate from STATUS_ELEMENT/STATUS_FRAGMENT)
const UNVISITED = 0;
const VISITED = 1;

/**
 * Node state for reconciliation - extends NodeRef with reconciliation metadata
 */
export type ReconcileNode<TData = unknown> = {
  position: number;
  reconcileStatus: typeof UNVISITED | typeof VISITED; // Separate from status field
  data: TData;
};

/**
 * Lifecycle hooks for reconciliation
 */
export type ReconcileHooks<T, TNode extends ReconcileNode> = {
  /**
   * Called when a new item needs to be created
   * Should return the created NodeRef
   */
  onCreate: (item: T, key: string) => TNode;

  /**
   * Called when an existing item's data should be updated
   * Should update the item's signal/state but not move DOM
   *
   * If the item needs to be recreated (e.g., plain value changed),
   * return the new node. The reconciler will update its tracking.
   */
  onUpdate: (item: T, node: TNode) => TNode | void;

  /**
   * Called when an item needs to be repositioned in DOM
   * Should move the element to the new position
   */
  onMove: (node: TNode, nextSibling: TNode | null | undefined) => void;

  /**
   * Called when an item is being removed
   * Should dispose scopes and remove from DOM
   */
  onRemove: (node: TNode) => void;
};

/**
 * Options for creating a reconciler
 */
export type ReconcilerOptions<
  T,
  TElement,
  TNode extends ReconcileNode,
> = ReconcileHooks<T, TNode> & {
  parentElement: TElement;
  parentRef?: ElementRef<TElement>;
  nextSibling?: TNode;
};

/**
 * Reconciler type - manages reconciliation state internally
 */
export type Reconciler<T, TNode extends ReconcileNode> = {
  /**
   * Reconcile items with the current state
   */
  reconcile: (
    items: T[],
    keyFn: (item: T, index: number) => string | number
  ) => TNode[];

  /**
   * Dispose all remaining items
   * Calls onRemove hook for each item still tracked
   */
  dispose: () => void;
};

/**
 * Binary search for LIS algorithm
 */
function binarySearch(
  arr: number[],
  tails: number[],
  len: number,
  value: number
): number {
  let lo = 0;
  let hi = len - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[tails[mid]!]! < value) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

/**
 * Find Longest Increasing Subsequence (LIS) using patience sorting
 * O(n log n) algorithm
 *
 * Exported for testing purposes
 */
export function findLIS(arr: number[], n: number, lisBuf: number[]): number {
  if (n <= 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  const tailsBuf: number[] = [];
  const parentBuf: number[] = [];
  let len = 0;

  // Forward phase: build tails and parent pointers
  for (let i = 0; i < n; i++) {
    const pos = binarySearch(arr, tailsBuf, len, arr[i]!);
    parentBuf[i] = pos > 0 ? tailsBuf[pos - 1]! : -1;
    tailsBuf[pos] = i;
    if (pos === len) len++;
  }

  // Backtrack phase: reconstruct LIS
  for (let i = len - 1, current = tailsBuf[i]!; i >= 0; i--) {
    lisBuf[i] = current;
    current = parentBuf[current]!;
  }

  return len;
}

/**
 * Create a reconciler that manages itemsByKey internally
 *
 * This encapsulates reconciliation state and provides a clean API
 * for reconciling and disposing items.
 */
export function createReconciler<
  T,
  TElement extends object,
  TNode extends ReconcileNode,
>(options: ReconcilerOptions<T, TElement, TNode>): Reconciler<T, TNode> {
  // Internal reconciliation state
  const itemsByKey = new Map<string, TNode>();

  // Pooled buffers for LIS calculation
  const oldIndicesBuf: number[] = [];
  const newPosBuf: number[] = [];
  const lisBuf: number[] = [];

  // Extract hooks from options
  const { onCreate, onUpdate, onMove, onRemove }: ReconcileHooks<T, TNode> =
    options;

  /**
   * Reconcile items with keys using LIS-based algorithm
   *
   * Uses closure variables for state and hooks
   */
  const reconcile = (
    items: T[],
    keyFn: (item: T, index: number) => string | number
  ): TNode[] => {
    // Clear pooled buffers
    oldIndicesBuf.length = 0;
    newPosBuf.length = 0;
    lisBuf.length = 0;

    const itemsLen = items.length;

    const nodes: TNode[] = Array<TNode>(itemsLen);

    // Build phase - create/update nodes
    let count = 0;
    let i = 0;
    for (i = 0; i < itemsLen; i++) {
      const item = items[i]!;
      const key = String(keyFn(item, i));
      let node = itemsByKey.get(key);

      if (node) {
        // Existing node - update via hook
        oldIndicesBuf[count] = node.position;
        newPosBuf[count] = i;
        count++;
        node.position = i;
        node.reconcileStatus = VISITED;

        // Call update hook - may return replacement node for plain value changes
        const replacement = onUpdate(item, node);
        if (replacement) {
          // Node was recreated - update tracking
          replacement.position = i;
          replacement.reconcileStatus = VISITED;
          itemsByKey.set(key, replacement);
          node = replacement;
        }
      } else {
        // New node - create via hook
        const nodeRef = onCreate(item, key);
        nodeRef.position = i;
        nodeRef.reconcileStatus = VISITED;

        node = nodeRef;
        itemsByKey.set(key, node);
      }

      nodes[i] = node;
    }

    // Prune phase - remove unvisited nodes
    for (const [key, node] of itemsByKey) {
      if (node.reconcileStatus === UNVISITED) {
        // Call removal hook
        onRemove(node);
        itemsByKey.delete(key);
      } else node.reconcileStatus = UNVISITED; // Reset for next reconciliation
    }

    // Skip LIS calculation if no count
    if (count === 0) return nodes;

    // Calculate LIS for minimal moves
    const lisLen = findLIS(oldIndicesBuf, count, lisBuf);

    const nodeLen = nodes.length;

    // Position phase - reorder based on LIS
    // Process in REVERSE order so each element can insert before the already-positioned next element
    // Use incremental index tracking instead of Set for zero-allocation LIS checking
    let lisIdx = lisLen - 1; // Start from end since we're processing in reverse
    for (i = nodeLen - 1; i >= 0; i--) {
      const node = nodes[i]!;

      // Check if current position matches LIS position (incremental, zero-allocation)
      const isInLIS =
        lisIdx >= 0 && node.position === newPosBuf[lisBuf[lisIdx]!]!;

      if (isInLIS) {
        // In LIS - already in correct position, decrement LIS index
        lisIdx--;
      } else {
        // Not in LIS - needs repositioning
        const newPos = i + 1;
        const nextSibling = newPos < nodeLen ? nodes[newPos] : undefined;
        onMove(node, nextSibling);
      }
      // Elements in LIS don't need to move - they're already in correct relative positions
    }

    return nodes;
  };

  const dispose = () => {
    // Call onRemove hook for all remaining items
    for (const [, node] of itemsByKey) {
      onRemove(node);
    }
    itemsByKey.clear();
  };

  return {
    reconcile,
    dispose,
  };
}

/**
 * State container for positional reconciliation (stored in closure)
 */
export type ReconcileState<TElement, TNode extends ReconcileNode> = {
  // Parent element reference
  parentElement: TElement;
  // Parent element ref (needed for fragment attach)
  parentRef?: ElementRef<TElement>;
  // Next sibling boundary marker
  nextSibling?: TNode;
};
