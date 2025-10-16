/**
 * List node management (like DOM node manipulation)
 *
 * Manages the doubly-linked list of items in a reactive list.
 * Like DOM nodes, ListItemNodes link directly to each other (no separate edge objects).
 *
 * DOM parallel:
 * - appendChild ↔ appendChild
 * - insertBefore ↔ insertBefore
 * - removeChild ↔ removeChild
 */

import type { DeferredListNode, ListItemNode } from '../types';

/**
 * Unlink a node from parent's children list
 * Like DOM removeChild internal logic
 */
function unlinkFromParent<T, TElement>(
  parent: DeferredListNode<TElement>,
  node: ListItemNode<T, TElement>
): void {
  const { previousSibling, nextSibling } = node;

  // Update next sibling's backward pointer
  if (nextSibling !== undefined) {
    nextSibling.previousSibling = previousSibling;
  } else {
    // This was the last child
    parent.lastChild = previousSibling;
  }

  // Update prev sibling's forward pointer
  if (previousSibling !== undefined) {
    previousSibling.nextSibling = nextSibling;
  } else {
    // This was the first child
    parent.firstChild = nextSibling;
  }
}

/**
 * Append a node to parent's children list
 * Like DOM appendChild
 */
export function appendChild<T, TElement>(
  parent: DeferredListNode<TElement>,
  node: ListItemNode<T, TElement>
): void {
  // Get current tail for O(1) append
  const prevSibling = parent.lastChild as ListItemNode<T, TElement> | undefined;

  // Wire node into list
  node.parentList = parent;
  node.previousSibling = prevSibling;
  node.nextSibling = undefined;

  // Update parent's tail pointer
  if (prevSibling !== undefined) {
    prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
  } else {
    // This is the first child
    parent.firstChild = node as ListItemNode<unknown, TElement>;
  }

  parent.lastChild = node as ListItemNode<unknown, TElement>;
}

/**
 * Insert a node before a reference sibling
 * Like DOM insertBefore
 */
export function insertBefore<T, TElement>(
  parent: DeferredListNode<TElement>,
  node: ListItemNode<T, TElement>,
  refSibling: ListItemNode<T, TElement> | undefined
): void {
  if (refSibling === undefined) {
    // Insert at end
    appendChild(parent, node);
    return;
  }

  const prevSibling = refSibling.previousSibling as ListItemNode<T, TElement> | undefined;

  // Wire node into list
  node.parentList = parent;
  node.previousSibling = prevSibling;
  node.nextSibling = refSibling as ListItemNode<unknown, TElement>;

  // Update sibling pointers
  refSibling.previousSibling = node as ListItemNode<unknown, TElement>;

  if (prevSibling !== undefined) {
    prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
  } else {
    // Inserting at head
    parent.firstChild = node as ListItemNode<unknown, TElement>;
  }
}

/**
 * Remove a node from the list
 * Like DOM removeChild
 */
export function removeChild<T, TElement>(
  node: ListItemNode<T, TElement>
): void {
  const parent = node.parentList;
  if (!parent) return;

  // Unlink from parent's children list
  unlinkFromParent(parent, node);

  // Clear node's parent reference
  node.parentList = undefined;
  node.previousSibling = undefined;
  node.nextSibling = undefined;
}

/**
 * Move a node to a new position (before refSibling)
 * Optimized operation: remove + insert
 * Like moving DOM nodes
 */
export function moveChild<T, TElement>(
  node: ListItemNode<T, TElement>,
  refSibling: ListItemNode<T, TElement> | undefined
): void {
  const parent = node.parentList;
  if (!parent) return;

  // Remove from current position
  unlinkFromParent(parent, node);

  // Insert at new position
  if (refSibling === undefined) {
    // Move to end
    const prevSibling = parent.lastChild as ListItemNode<T, TElement> | undefined;
    node.previousSibling = prevSibling;
    node.nextSibling = undefined;

    if (prevSibling !== undefined) {
      prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
    } else {
      parent.firstChild = node as ListItemNode<unknown, TElement>;
    }

    parent.lastChild = node as ListItemNode<unknown, TElement>;
  } else {
    // Move before refSibling
    const prevSibling = refSibling.previousSibling as ListItemNode<T, TElement> | undefined;
    node.previousSibling = prevSibling;
    node.nextSibling = refSibling as ListItemNode<unknown, TElement>;

    refSibling.previousSibling = node as ListItemNode<unknown, TElement>;

    if (prevSibling !== undefined) {
      prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
    } else {
      parent.firstChild = node as ListItemNode<unknown, TElement>;
    }
  }
}
