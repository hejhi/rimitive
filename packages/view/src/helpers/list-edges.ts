/**
 * PATTERN: List edge management (inspired by signals/helpers/graph-edges.ts)
 *
 * Manages the doubly-linked list of items in a reactive list.
 * Like signals' Dependency edges, ListItemEdge participates in TWO lists:
 * 1. Parent's children list (sibling navigation)
 * 2. Item's parent reference (hierarchy navigation)
 */

import type { DeferredListNode, ListItemNode, ListItemEdge } from '../types';

/**
 * Unlink an item edge from parent's children list
 * PATTERN: Like unlinkFromProducer in signals
 */
function unlinkFromParent<T, TElement>(
  parent: DeferredListNode<TElement>,
  edge: ListItemEdge<T, TElement>
): void {
  const { prevSibling, nextSibling } = edge;

  // Update next sibling's backward pointer
  if (nextSibling !== undefined) {
    nextSibling.prevSibling = prevSibling;
  } else {
    // This was the last child
    parent.lastChild = prevSibling as ListItemEdge<unknown, TElement> | undefined;
  }

  // Update prev sibling's forward pointer
  if (prevSibling !== undefined) {
    prevSibling.nextSibling = nextSibling;
  } else {
    // This was the first child
    parent.firstChild = nextSibling as ListItemEdge<unknown, TElement> | undefined;
  }
}

/**
 * Append an item edge to parent's children list
 * PATTERN: Like appending to producer.subscribers in signals
 */
export function appendChild<T, TElement>(
  parent: DeferredListNode<TElement>,
  item: ListItemNode<T, TElement>
): ListItemEdge<T, TElement> {
  // Get current tail for O(1) append
  const prevSibling = parent.lastChild as ListItemEdge<T, TElement> | undefined;

  // Create new edge
  const edge: ListItemEdge<T, TElement> = {
    parent,
    item,
    prevSibling,
    nextSibling: undefined,
  };

  // Wire into parent's children list
  if (prevSibling !== undefined) {
    prevSibling.nextSibling = edge;
  } else {
    // This is the first child
    parent.firstChild = edge as ListItemEdge<unknown, TElement>;
  }

  parent.lastChild = edge as ListItemEdge<unknown, TElement>;

  // Wire into item's parent reference
  item.parentEdge = edge;

  return edge;
}

/**
 * Insert an item edge before a reference sibling
 * PATTERN: Like inserting into dependency list in signals
 */
export function insertBefore<T, TElement>(
  parent: DeferredListNode<TElement>,
  item: ListItemNode<T, TElement>,
  refSibling: ListItemEdge<T, TElement> | undefined
): ListItemEdge<T, TElement> {
  if (refSibling === undefined) {
    // Insert at end
    return appendChild(parent, item);
  }

  const prevSibling = refSibling.prevSibling;

  // Create new edge
  const edge: ListItemEdge<T, TElement> = {
    parent,
    item,
    prevSibling,
    nextSibling: refSibling,
  };

  // Wire into parent's children list
  refSibling.prevSibling = edge;

  if (prevSibling !== undefined) {
    prevSibling.nextSibling = edge;
  } else {
    // Inserting at head
    parent.firstChild = edge as ListItemEdge<unknown, TElement>;
  }

  // Wire into item's parent reference
  item.parentEdge = edge;

  return edge;
}

/**
 * Remove an item from the list
 * PATTERN: Like detaching dependency in signals
 */
export function removeChild<T, TElement>(
  edge: ListItemEdge<T, TElement>
): void {
  const { parent, item } = edge;

  // Unlink from parent's children list
  unlinkFromParent(parent, edge);

  // Clear item's parent reference
  item.parentEdge = undefined;
}

/**
 * Move an item to a new position (before refSibling)
 * Optimized operation: remove + insert
 */
export function moveChild<T, TElement>(
  edge: ListItemEdge<T, TElement>,
  refSibling: ListItemEdge<T, TElement> | undefined
): void {
  const { parent } = edge;

  // Remove from current position
  unlinkFromParent(parent, edge);

  // Insert at new position
  if (refSibling === undefined) {
    // Move to end
    const prevSibling = parent.lastChild as ListItemEdge<T, TElement> | undefined;
    edge.prevSibling = prevSibling;
    edge.nextSibling = undefined;

    if (prevSibling !== undefined) {
      prevSibling.nextSibling = edge;
    } else {
      parent.firstChild = edge as ListItemEdge<unknown, TElement>;
    }

    parent.lastChild = edge as ListItemEdge<unknown, TElement>;
  } else {
    // Move before refSibling
    const prevSibling = refSibling.prevSibling;
    edge.prevSibling = prevSibling;
    edge.nextSibling = refSibling;

    refSibling.prevSibling = edge;

    if (prevSibling !== undefined) {
      prevSibling.nextSibling = edge;
    } else {
      parent.firstChild = edge as ListItemEdge<unknown, TElement>;
    }
  }
}
