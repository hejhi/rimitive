/**
 * Array reconciliation - mutates iter with minimal operations
 */

import { findLIS } from './lis';
import type { Iter, IterNode } from './iter';

export type ReconcileCallbacks<T> = {
  onInsert?: (node: IterNode<T>, beforeNode: IterNode<T> | null) => void;
  onRemove?: (node: IterNode<T>) => void;
  onMove?: (node: IterNode<T>, beforeNode: IterNode<T> | null) => void;
  onUpdate?: (node: IterNode<T>, oldValue: T) => void;
};

/**
 * Reconciles an iter with new items, mutating the iter and calling callbacks.
 * Uses LIS algorithm for minimal moves.
 */
export function reconcile<T>(
  list: Iter<T>,
  newItems: T[],
  callbacks: ReconcileCallbacks<T> = {}
): void {
  const { onInsert, onRemove, onMove, onUpdate } = callbacks;
  const keyFn = list.keyFn;
  const newSize = newItems.length;
  // Use peek().length to avoid tracking version signal
  // (list.size reads version() which would cause effect re-runs during reconcile)
  const oldSize = list.peek().length;

  // Empty cases
  if (newSize === 0 && oldSize === 0) return;

  if (newSize === 0) {
    // Remove all - collect nodes first since we're modifying during iteration
    // Walk using head/next to avoid tracking version (list.nodes() reads version)
    const toRemove: IterNode<T>[] = [];
    for (let cur = list.head; cur; cur = cur.next) toRemove.push(cur);
    for (const node of toRemove) {
      list.remove(node.key);
      onRemove?.(node);
    }
    return;
  }

  if (oldSize === 0) {
    // Append all
    for (const item of newItems) {
      const node = list.append(item);
      onInsert?.(node, null);
    }
    return;
  }

  // Fast path: check for append/truncate (prefix match)
  let cur = list.head;
  let prefixLen = 0;
  while (cur && prefixLen < newSize) {
    const item = newItems[prefixLen]!;
    if (cur.key !== keyFn(item)) break;
    // Update value if changed
    if (cur.value !== item) {
      const oldValue = cur.value;
      cur.value = item;
      onUpdate?.(cur, oldValue);
    }
    cur = cur.next;
    prefixLen++;
  }

  // All old items matched prefix
  if (cur === null && prefixLen === oldSize) {
    if (prefixLen < newSize) {
      // Append remaining
      for (let i = prefixLen; i < newSize; i++) {
        const node = list.append(newItems[i]!);
        onInsert?.(node, null);
      }
    }
    // else: exact match, nothing to do
    return;
  }

  // New items are prefix of old (truncate)
  if (cur !== null && prefixLen === newSize) {
    const toRemove: IterNode<T>[] = [];
    while (cur) {
      toRemove.push(cur);
      cur = cur.next;
    }
    for (const node of toRemove) {
      list.remove(node.key);
      onRemove?.(node);
    }
    return;
  }

  // Fast path: check for prepend
  if (newSize > oldSize) {
    const offset = newSize - oldSize;
    let isPrepend = true;
    cur = list.head;
    for (let i = 0; i < oldSize && isPrepend; i++) {
      if (!cur || cur.key !== keyFn(newItems[offset + i]!)) isPrepend = false;
      else cur = cur.next;
    }
    if (isPrepend) {
      // Update existing items
      cur = list.head;
      for (let i = 0; i < oldSize && cur; i++) {
        const item = newItems[offset + i]!;
        if (cur.value !== item) {
          const oldValue = cur.value;
          cur.value = item;
          onUpdate?.(cur, oldValue);
        }
        cur = cur.next;
      }
      // Prepend new items (insert each before current head)
      for (let i = offset - 1; i >= 0; i--) {
        const currentHead = list.head!;
        const node = list.insertBefore(currentHead.key, newItems[i]!);
        if (node) onInsert?.(node, currentHead);
      }
      return;
    }
  }

  // Full reconciliation
  // Build old position map
  const oldPositions = new Map<string | number, number>();
  let pos = 0;
  for (cur = list.head; cur; cur = cur.next) {
    oldPositions.set(cur.key, pos++);
  }

  // Process new items - cache nodes by new position
  const newKeys = new Set<string | number>();
  const oldIndices: number[] = [];
  const existingIndices: number[] = [];
  const newItemOldPos: number[] = [];
  const newItemNodes: (IterNode<T> | null)[] = [];

  for (let i = 0; i < newSize; i++) {
    const item = newItems[i]!;
    const key = keyFn(item);
    newKeys.add(key);
    const oldPos = oldPositions.get(key);
    const node = oldPos !== undefined ? list.getNode(key)! : null;

    newItemOldPos[i] = oldPos ?? -1;
    newItemNodes[i] = node;

    if (node) {
      oldIndices.push(oldPos!);
      existingIndices.push(i);
      // Update value if changed
      if (node.value !== item) {
        const oldValue = node.value;
        node.value = item;
        onUpdate?.(node, oldValue);
      }
    }
  }

  // Remove items not in new set
  const toRemove: IterNode<T>[] = [];
  for (cur = list.head; cur; cur = cur.next) {
    if (!newKeys.has(cur.key)) toRemove.push(cur);
  }
  for (const node of toRemove) {
    list.remove(node.key);
    onRemove?.(node);
  }

  // LIS to find stable items
  const lisSet = new Set<number>();
  const keptCount = oldIndices.length;
  if (keptCount > 0) {
    const lisBuf = new Array<number>(keptCount);
    const tailsBuf = new Array<number>(keptCount);
    const parentBuf = new Array<number>(keptCount);
    const lisLen = findLIS(oldIndices, keptCount, lisBuf, tailsBuf, parentBuf);
    for (let i = 0; i < lisLen; i++) {
      lisSet.add(existingIndices[lisBuf[i]!]!);
    }
  }

  // Insert/move (backwards for correct positioning)
  for (let i = newSize - 1; i >= 0; i--) {
    const oldPos = newItemOldPos[i]!;
    const nextNode = newItemNodes[i + 1] ?? null;

    if (oldPos < 0) {
      // New item - insert
      let node: IterNode<T>;
      if (nextNode) {
        node = list.insertBefore(nextNode.key, newItems[i]!)!;
      } else {
        node = list.append(newItems[i]!);
      }
      newItemNodes[i] = node; // Cache for next iteration's nextNode
      onInsert?.(node, nextNode);
    } else if (!lisSet.has(i)) {
      // Existing but needs to move - use cached nodes
      const node = newItemNodes[i]!;
      list.moveNodeBefore(node, nextNode);
      onMove?.(node, nextNode);
    }
  }
}
