/**
 * RefSpec-based reconciliation for reactive arrays
 *
 * This provides reconciliation utilities that work with RefSpecs (with keys)
 * instead of being tied to fragment implementations. Enables user-space
 * reactive helpers using the closure pattern.
 */

import type { ElementRef } from '../types';
import { findLIS } from '@rimitive/signals/lis';

// Re-export for tests that import from here
export { findLIS };

// Status bits for reconciliation (separate from STATUS_ELEMENT/STATUS_FRAGMENT)
const UNVISITED = 0;
const VISITED = 1;
const CREATED = 2; // Marks nodes created in current reconcile pass

/**
 * Node state for reconciliation - extends NodeRef with reconciliation metadata
 */
export type ReconcileNode<TData = unknown> = {
  position: number;
  reconcileStatus: typeof UNVISITED | typeof VISITED | typeof CREATED; // Separate from status field
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
  const tailsBuf: number[] = [];
  const parentBuf: number[] = [];

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
        nodeRef.reconcileStatus = CREATED;

        node = nodeRef;
        itemsByKey.set(key, node);
      }

      nodes[i] = node;
    }

    // Prune phase - remove unvisited nodes
    // Note: We don't reset CREATED/VISITED here - that happens after the position phase
    for (const [key, node] of itemsByKey) {
      if (node.reconcileStatus === UNVISITED) {
        // Call removal hook
        onRemove(node);
        itemsByKey.delete(key);
      }
    }

    // Skip LIS calculation if no existing nodes to reorder
    if (count === 0) {
      // Reset all statuses for next reconciliation
      for (const node of itemsByKey.values()) {
        node.reconcileStatus = UNVISITED;
      }
      return nodes;
    }

    // Ensure LIS buffers are large enough
    if (tailsBuf.length < count) {
      tailsBuf.length = count;
      parentBuf.length = count;
    }

    // Calculate LIS for minimal moves
    const lisLen = findLIS(oldIndicesBuf, count, lisBuf, tailsBuf, parentBuf);

    const nodeLen = nodes.length;

    // Position phase - reorder based on LIS
    // Process in REVERSE order so each element can insert before the already-positioned next element
    // Use incremental index tracking instead of Set for zero-allocation LIS checking
    let lisIdx = lisLen - 1; // Start from end since we're processing in reverse
    // Track if the "tail" consists only of CREATED nodes (appended items don't need moves)
    let tailIsCreated = true;
    for (i = nodeLen - 1; i >= 0; i--) {
      const node = nodes[i]!;
      const isCreated = node.reconcileStatus === CREATED;

      // Skip CREATED nodes that are part of the contiguous appended tail
      // These were appended by onCreate and are already in correct position
      if (isCreated && tailIsCreated) {
        continue;
      }

      // Once we hit a non-created node, the tail property no longer applies
      if (!isCreated) {
        tailIsCreated = false;
      }

      // Check if current position matches LIS position (incremental, zero-allocation)
      const isInLIS =
        !isCreated &&
        lisIdx >= 0 &&
        node.position === newPosBuf[lisBuf[lisIdx]!]!;

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

    // Reset all statuses for next reconciliation
    for (const node of itemsByKey.values()) {
      node.reconcileStatus = UNVISITED;
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
