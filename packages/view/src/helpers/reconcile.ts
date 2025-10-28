/**
 * RefSpec-based reconciliation for reactive arrays
 *
 * This provides reconciliation utilities that work with RefSpecs (with keys)
 * instead of being tied to fragment implementations. Enables user-space
 * reactive helpers using the closure pattern.
 */

import type { RefSpec, NodeRef, ElementRef } from '../types';
import type { Element as RendererElement } from '../renderer';

// Status bits for reconciliation (separate from STATUS_ELEMENT/STATUS_FRAGMENT)
const UNVISITED = 0;
const VISITED = 1;

/**
 * Node state for reconciliation - extends NodeRef with reconciliation metadata
 */
export type ReconcileNode<TElement> = NodeRef<TElement> & {
  key: string;
  position: number;
  reconcileStatus: typeof UNVISITED | typeof VISITED; // Separate from status field
};

/**
 * Positional item - tracks RefSpec identity for reuse
 */
export interface PositionalItem<TElement> {
  refSpec: RefSpec<TElement>;
  nodeRef: NodeRef<TElement>;
}

/**
 * Lifecycle hooks for reconciliation
 */
export interface ReconcileHooks<T, TElement> {
  /**
   * Called when a new item needs to be created
   * Should return the created NodeRef
   */
  onCreate: (item: T, key: string) => NodeRef<TElement>;

  /**
   * Called when an existing item's data should be updated
   * Should update the item's signal/state but not move DOM
   */
  onUpdate: (key: string, item: T, node: NodeRef<TElement>) => void;

  /**
   * Called when an item needs to be repositioned in DOM
   * Should move the element to the new position
   */
  onMove: (key: string, node: NodeRef<TElement>, nextSibling: NodeRef<TElement> | null | undefined) => void;

  /**
   * Called when an item is being removed
   * Should dispose scopes and remove from DOM
   */
  onRemove: (key: string, node: NodeRef<TElement>) => void;
}

/**
 * Options for creating a reconciler
 */
export interface ReconcilerOptions<T, TElement> extends ReconcileHooks<T, TElement> {
  parentElement: TElement;
  parentRef?: ElementRef<TElement>;
  nextSibling?: NodeRef<TElement>;
}

/**
 * Reconciler interface - manages reconciliation state internally
 */
export interface Reconciler<T, TElement> {
  /**
   * Reconcile items with the current state
   */
  reconcile: (
    items: T[],
    keyFn: (item: T, index: number) => string | number
  ) => NodeRef<TElement>[];

  /**
   * Dispose all remaining items
   * Calls onRemove hook for each item still tracked
   */
  dispose: () => void;
}

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
export function createReconciler<T, TElement extends RendererElement>(
  options: ReconcilerOptions<T, TElement>
): Reconciler<T, TElement> {
    // Internal reconciliation state
    const itemsByKey = new Map<string, ReconcileNode<TElement>>();

    // Pooled buffers for LIS calculation
    const oldIndicesBuf: number[] = [];
    const newPosBuf: number[] = [];
    const lisBuf: number[] = [];

    // Extract hooks from options
    const { onCreate, onUpdate, onMove, onRemove }: ReconcileHooks<T, TElement> = options;

    /**
     * Reconcile items with keys using LIS-based algorithm
     *
     * Uses closure variables for state and hooks
     */
    const reconcile = (
      items: T[],
      keyFn: (item: T, index: number) => string | number
    ): NodeRef<TElement>[] => {
      // Clear pooled buffers
      oldIndicesBuf.length = 0;
      newPosBuf.length = 0;
      lisBuf.length = 0;

      const itemsLen = items.length;

      const nodes: ReconcileNode<TElement>[] =
        Array<ReconcileNode<TElement>>(itemsLen);

      // Build phase - create/update nodes
      let count = 0;
      for (let i = 0; i < itemsLen; i++) {
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

          // Call update hook if provided
          onUpdate(key, item, node);
        } else {
          // New node - create via hook
          const nodeRef = onCreate(item, key) as ReconcileNode<TElement>;
          nodeRef.key = key;
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
          onRemove(key, node);
          itemsByKey.delete(key);
        } else node.reconcileStatus = UNVISITED; // Reset for next reconciliation
      }

      // Calculate LIS for minimal moves
      const lisLen = findLIS(oldIndicesBuf, count, lisBuf);

      // Build set of LIS positions for O(1) lookup
      const lisPositions = new Set<number>();
      for (let i = 0; i < lisLen; i++) {
        lisPositions.add(newPosBuf[lisBuf[i]!]!);
      }

      const nodeLen = nodes.length;

      // Position phase - reorder based on LIS
      // Process in REVERSE order so each element can insert before the already-positioned next element
      for (let i = nodeLen - 1; i >= 0; i--) {
        const node = nodes[i]!;

        if (!lisPositions.has(node.position)) {
          // Not in LIS - needs repositioning
          // Find next sibling (or null/undefined for end)
          const nextSibling = i + 1 < nodeLen ? nodes[i + 1]! : undefined;

          // Call move hook
          onMove(node.key, node, nextSibling);
        }
        // Elements in LIS don't need to move - they're already in correct relative positions
      }

      return nodes;
    }

    const dispose = () => {
      // Call onRemove hook for all remaining items
      for (const [key, node] of itemsByKey) {
        onRemove(key, node);
      }
      itemsByKey.clear();
    }

    return {
      reconcile,
      dispose,
    };
}

/**
 * State container for positional reconciliation (stored in closure)
 */
export interface ReconcileState<TElement> {
  // Positional array for index-based lookup
  itemsByIndex: PositionalItem<TElement>[];
  // Parent element reference
  parentElement: TElement;
  // Parent element ref (needed for fragment attach)
  parentRef?: ElementRef<TElement>;
  // Next sibling boundary marker
  nextSibling?: NodeRef<TElement>;
}
