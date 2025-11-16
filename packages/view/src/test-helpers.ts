/**
 * Shared test helpers for creating scopes with mock dependencies
 *
 * These helpers provide a clean public API for tests without exposing internals.
 */

import { vi } from 'vitest';
import { createScopes } from './helpers/scope';
import type { LinkedNode } from './types';

// Mock element for testing
export type MockTestElement = { __mock: boolean };
export const createMockElement = (): MockTestElement => ({ __mock: true });

/**
 * Create scopes with mock dependencies for testing
 *
 * This provides the same public API as the production createScopes,
 * but with a mocked baseEffect for testing purposes.
 */
export const createTestScopes = () => {
  // Mock effect that runs synchronously for testing
  const baseEffect = vi.fn((fn: () => void | (() => void)) => {
    const cleanup = fn();
    return cleanup || (() => {});
  });

  const scopes = createScopes({ baseEffect });

  return {
    ...scopes,
    baseEffect,
  };
};

/**
 * Create a test scheduler with batching support for testing event handlers
 */
export const createTestScheduler = () => {
  let batchDepth = 0;

  return {
    get batchDepth() {
      return batchDepth;
    },
    batch<T>(fn: () => T): T {
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
      }
    },
  };
};

/**
 * Validate doubly-linked list integrity
 *
 * Checks that:
 * - Forward traversal (via next) and backward traversal (via prev) are consistent
 * - Each node's prev points to the actual previous node
 * - Each node's next points to the actual next node
 *
 * @param first - First node in the list (or undefined for empty list)
 * @returns true if list is valid, false if corruption detected
 */
export function validateLinkedList<T>(
  first: LinkedNode<T> | undefined | null
): boolean {
  if (!first) return true; // Empty list is valid

  let current = first;
  let prev: LinkedNode<T> | null = null;

  // Forward pass: check that prev pointers match actual previous node
  while (current) {
    // Check backward link matches
    if (current.prev !== prev) {
      return false;
    }

    // Move forward
    prev = current;
    const nextNode = current.next as LinkedNode<T> | null;
    if (!nextNode) break;
    current = nextNode;
  }

  // Backward pass: verify we can traverse back to start
  let reverseNode = prev; // Start from last node
  let next: LinkedNode<T> | null = null;

  while (reverseNode) {
    // Check forward link matches
    if (reverseNode.next !== next) {
      return false;
    }

    // Move backward
    next = reverseNode;
    const prevNode = reverseNode.prev as LinkedNode<T> | null;
    if (!prevNode) break;
    reverseNode = prevNode;
  }

  // Should have arrived back at first node
  return next === first;
}

/**
 * Count nodes in a doubly-linked list
 *
 * @param first - First node in the list
 * @returns Number of nodes in the list
 */
export function countLinkedNodes<T>(
  first: LinkedNode<T> | undefined | null
): number {
  let count = 0;
  let current = first;

  while (current) {
    count++;
    current = current.next as LinkedNode<T> | null;
  }

  return count;
}

/**
 * Convert linked list to array for easier testing/debugging
 *
 * @param first - First node in the list
 * @returns Array of nodes in forward order
 */
export function linkedListToArray<T>(
  first: LinkedNode<T> | undefined | null
): LinkedNode<T>[] {
  const result: LinkedNode<T>[] = [];
  let current = first;

  while (current) {
    result.push(current);
    current = current.next as LinkedNode<T> | null;
  }

  return result;
}
