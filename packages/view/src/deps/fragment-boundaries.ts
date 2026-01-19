/**
 * Fragment boundary maintenance helpers
 * Functions to update firstChild/lastChild when fragment contents change
 */

import type { FragmentRef, LinkedNode, NodeRef } from '../types';

/**
 * Add a node to a fragment's range
 * Updates firstChild/lastChild as needed based on insertion position
 *
 * @param fragment - Fragment to update
 * @param node - Node being added
 * @param position - Where the node is being added ('start' or 'end')
 */
export function addToFragment<T>(
  fragment: FragmentRef<T>,
  node: LinkedNode<T>,
  position: 'start' | 'end'
): void {
  if (!fragment.firstChild) {
    // Empty fragment - this is first node
    fragment.firstChild = node;
    fragment.lastChild = node;
    return;
  }

  if (position === 'start') {
    fragment.firstChild = node;
  } else {
    fragment.lastChild = node;
  }
}

/**
 * Remove a node from a fragment's range
 * Updates firstChild/lastChild if the node was at a boundary
 *
 * @param fragment - Fragment to update
 * @param node - Node being removed
 */
export function removeFromFragment<T>(
  fragment: FragmentRef<T>,
  node: LinkedNode<T>
): void {
  // Update boundaries if this was a boundary node
  if (node === fragment.firstChild) {
    fragment.firstChild = node.next;
  }
  if (node === fragment.lastChild) {
    fragment.lastChild = node.prev;
  }

  // If fragment is now empty (both boundaries cleared)
  if (!fragment.firstChild || !fragment.lastChild) {
    fragment.firstChild = null;
    fragment.lastChild = null;
  }
}

/**
 * Check if a node is within a fragment's range
 * Walks from firstChild to lastChild checking for the node
 *
 * @param fragment - Fragment to check
 * @param node - Node to search for
 * @returns True if node is in fragment's range
 */
export function isInFragmentRange<T>(
  fragment: FragmentRef<T>,
  node: LinkedNode<T>
): boolean {
  let current = fragment.firstChild;

  while (current) {
    if (current === node) return true;
    if (current === fragment.lastChild) break;
    current = current.next;
  }

  return false;
}

/**
 * Update fragment boundaries when a node is inserted between existing nodes
 * Used during reconciliation when items move around
 *
 * @param fragment - Fragment to update
 * @param insertedNode - Node that was just inserted
 * @param beforeNode - Node that insertedNode was placed before (or undefined if at end)
 */
export function updateBoundariesAfterInsert<T>(
  fragment: FragmentRef<T>,
  insertedNode: LinkedNode<T>,
  beforeNode: LinkedNode<T> | undefined
): void {
  // If fragment was empty, this is the only node
  if (!fragment.firstChild) {
    fragment.firstChild = insertedNode;
    fragment.lastChild = insertedNode;
    return;
  }

  // If inserted before firstChild, update firstChild
  if (beforeNode === fragment.firstChild) {
    fragment.firstChild = insertedNode;
  }

  // If inserted at end (beforeNode is undefined), update lastChild
  if (!beforeNode) {
    fragment.lastChild = insertedNode;
  }
}

/**
 * Count nodes in a fragment's range
 * Useful for debugging and validation
 *
 * @param fragment - Fragment to count
 * @returns Number of nodes in fragment
 */
export function countFragmentNodes<T>(fragment: FragmentRef<T>): number {
  let count = 0;
  let current = fragment.firstChild;

  while (current) {
    count++;
    if (current === fragment.lastChild) break;
    current = current.next;
  }

  return count;
}

/**
 * Set a fragment's boundaries to wrap a single child node.
 * Child is always kept in the tree (not made transparent).
 * If child is null, clears the fragment.
 *
 * @param fragment - Fragment to update
 * @param child - Child node to wrap, or null to clear
 */
export function setFragmentChild<T>(
  fragment: FragmentRef<T>,
  child: NodeRef<T> | null
): void {
  if (!child) {
    fragment.firstChild = null;
    fragment.lastChild = null;
  } else {
    // Always keep child in tree - don't adopt boundaries for fragments
    // This ensures nested fragments (like async load boundaries) remain discoverable
    fragment.firstChild = child;
    fragment.lastChild = child;
  }
}
