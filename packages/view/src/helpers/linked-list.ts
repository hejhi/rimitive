/**
 * Doubly-linked list manipulation helpers
 * Pure functions for prev/next pointer maintenance
 */

import type { ElementRef, LinkedNode } from '../types';
import { STATUS_ELEMENT } from '../types';

/**
 * Link a node into the doubly-linked list before nextNode
 * Updates prev/next pointers for node and surrounding nodes
 *
 * @param node - Node to insert
 * @param nextNode - Node to insert before (or undefined to append to end)
 */
export function linkBefore<T>(
  node: LinkedNode<T>,
  nextNode: LinkedNode<T> | undefined | null
): void {
  node.prev = nextNode?.prev ?? null;
  node.next = nextNode ?? null;

  if (nextNode?.prev) {
    nextNode.prev.next = node;
  }
  if (nextNode) {
    nextNode.prev = node;
  }
}

/**
 * Unlink a node from the doubly-linked list
 * Updates surrounding nodes' prev/next pointers and clears node's pointers
 *
 * @param node - Node to remove from list
 */
export function unlink<T>(node: LinkedNode<T>): void {
  if (node.prev) {
    node.prev.next = node.next;
  }
  if (node.next) {
    node.next.prev = node.prev;
  }

  node.prev = null;
  node.next = null;
}

/**
 * Get the next element in the list (skips comments if needed)
 * Useful when you specifically need an ElementRef, not just any LinkedNode
 *
 * @param node - Starting node
 * @returns Next ElementRef, or undefined if none found
 */
export function getNextElement<T>(
  node: LinkedNode<T> | undefined | null
): ElementRef<T> | undefined {
  let current = node;

  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current;
    }
    current = current.next as LinkedNode<T> | null;
  }

  return undefined;
}

/**
 * Get the previous element in the list (skips comments if needed)
 * Useful when you specifically need an ElementRef, not just any LinkedNode
 *
 * @param node - Starting node
 * @returns Previous ElementRef, or undefined if none found
 */
export function getPrevElement<T>(
  node: LinkedNode<T> | undefined | null
): ElementRef<T> | undefined {
  let current = node;

  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current;
    }
    current = current.prev as LinkedNode<T> | null;
  }

  return undefined;
}
