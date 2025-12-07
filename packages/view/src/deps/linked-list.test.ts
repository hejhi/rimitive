/**
 * Tests for doubly-linked list manipulation helpers
 */

import { describe, it, expect } from 'vitest';
import {
  linkBefore,
  unlink,
  getNextElement,
  getPrevElement,
} from './linked-list';
import { STATUS_ELEMENT } from '../types';
import type { ElementRef } from '../types';
import { validateLinkedList, countLinkedNodes } from '../test-helpers';

// Test helpers to create mock nodes
function createElementRef<T>(element: T): ElementRef<T> {
  return {
    status: STATUS_ELEMENT,
    element,
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  };
}

describe('linkBefore', () => {
  it('should link a single node (empty list)', () => {
    const node1 = createElementRef('a');

    linkBefore(node1, null);

    expect(node1.prev).toBe(null);
    expect(node1.next).toBe(null);
    expect(validateLinkedList(node1)).toBe(true);
  });

  it('should link node at start of list', () => {
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    // Create list: node1
    linkBefore(node1, null);

    // Insert node2 before node1: node2 -> node1
    linkBefore(node2, node1);

    expect(node2.prev).toBe(null);
    expect(node2.next).toBe(node1);
    expect(node1.prev).toBe(node2);
    expect(node1.next).toBe(null);
    expect(validateLinkedList(node2)).toBe(true);
  });

  it('should link node at end of list', () => {
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    // Create list: node1
    linkBefore(node1, null);

    // Insert node2 after node1: node1 -> node2
    linkBefore(node2, null);
    node1.next = node2;
    node2.prev = node1;

    expect(node1.prev).toBe(null);
    expect(node1.next).toBe(node2);
    expect(node2.prev).toBe(node1);
    expect(node2.next).toBe(null);
    expect(validateLinkedList(node1)).toBe(true);
  });

  it('should link node in middle of list', () => {
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');
    const node3 = createElementRef('c');

    // Create list: node1 -> node3
    linkBefore(node1, null);
    linkBefore(node3, null);
    node1.next = node3;
    node3.prev = node1;

    // Insert node2 in middle: node1 -> node2 -> node3
    linkBefore(node2, node3);

    expect(node1.next).toBe(node2);
    expect(node2.prev).toBe(node1);
    expect(node2.next).toBe(node3);
    expect(node3.prev).toBe(node2);
    expect(validateLinkedList(node1)).toBe(true);
    expect(countLinkedNodes(node1)).toBe(3);
  });

  it('should handle linking with undefined nextNode', () => {
    const node = createElementRef('a');

    linkBefore(node, undefined);

    expect(node.prev).toBe(null);
    expect(node.next).toBe(null);
  });
});

describe('unlink', () => {
  it('should unlink a single node', () => {
    const node = createElementRef('a');

    linkBefore(node, null);
    unlink(node);

    expect(node.prev).toBe(null);
    expect(node.next).toBe(null);
  });

  it('should unlink node from start of list', () => {
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');
    const node3 = createElementRef('c');

    // Create list: node1 -> node2 -> node3
    linkBefore(node1, null);
    linkBefore(node2, null);
    linkBefore(node3, null);
    node1.next = node2;
    node2.prev = node1;
    node2.next = node3;
    node3.prev = node2;

    // Unlink node1: node2 -> node3
    unlink(node1);

    expect(node1.prev).toBe(null);
    expect(node1.next).toBe(null);
    expect(node2.prev).toBe(null);
    expect(node2.next).toBe(node3);
    expect(node3.prev).toBe(node2);
    expect(validateLinkedList(node2)).toBe(true);
    expect(countLinkedNodes(node2)).toBe(2);
  });

  it('should unlink node from middle of list', () => {
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');
    const node3 = createElementRef('c');

    // Create list: node1 -> node2 -> node3
    linkBefore(node1, null);
    linkBefore(node2, null);
    linkBefore(node3, null);
    node1.next = node2;
    node2.prev = node1;
    node2.next = node3;
    node3.prev = node2;

    // Unlink node2: node1 -> node3
    unlink(node2);

    expect(node2.prev).toBe(null);
    expect(node2.next).toBe(null);
    expect(node1.next).toBe(node3);
    expect(node3.prev).toBe(node1);
    expect(validateLinkedList(node1)).toBe(true);
    expect(countLinkedNodes(node1)).toBe(2);
  });

  it('should unlink node from end of list', () => {
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');
    const node3 = createElementRef('c');

    // Create list: node1 -> node2 -> node3
    linkBefore(node1, null);
    linkBefore(node2, null);
    linkBefore(node3, null);
    node1.next = node2;
    node2.prev = node1;
    node2.next = node3;
    node3.prev = node2;

    // Unlink node3: node1 -> node2
    unlink(node3);

    expect(node3.prev).toBe(null);
    expect(node3.next).toBe(null);
    expect(node2.next).toBe(null);
    expect(validateLinkedList(node1)).toBe(true);
    expect(countLinkedNodes(node1)).toBe(2);
  });

  it('should handle multiple unlink operations', () => {
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
      createElementRef('d'),
    ];

    // Create list: a -> b -> c -> d
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      linkBefore(node, null);
      if (i > 0) {
        nodes[i - 1]!.next = node;
        node.prev = nodes[i - 1]!;
      }
    }

    expect(validateLinkedList(nodes[0])).toBe(true);
    expect(countLinkedNodes(nodes[0])).toBe(4);

    // Unlink b and c: a -> d
    unlink(nodes[1]!);
    unlink(nodes[2]!);

    expect(nodes[0]!.next).toBe(nodes[3]);
    expect(nodes[3]!.prev).toBe(nodes[0]);
    expect(validateLinkedList(nodes[0])).toBe(true);
    expect(countLinkedNodes(nodes[0])).toBe(2);
  });

  it('should handle unlinking when node has no neighbors', () => {
    const node = createElementRef('a');
    node.prev = null;
    node.next = null;

    unlink(node);

    expect(node.prev).toBe(null);
    expect(node.next).toBe(null);
  });
});

describe('getNextElement', () => {
  it('should return undefined for empty list', () => {
    expect(getNextElement(null)).toBe(undefined);
    expect(getNextElement(undefined)).toBe(undefined);
  });

  it('should return element when node is element', () => {
    const elem = createElementRef('div');

    expect(getNextElement(elem)).toBe(elem);
  });
});

describe('getPrevElement', () => {
  it('should return undefined for empty list', () => {
    expect(getPrevElement(null)).toBe(undefined);
    expect(getPrevElement(undefined)).toBe(undefined);
  });

  it('should return element when node is element', () => {
    const elem = createElementRef('div');

    expect(getPrevElement(elem)).toBe(elem);
  });
});

describe('integration tests', () => {
  it('should maintain list integrity through multiple operations', () => {
    const nodes = Array.from({ length: 5 }, (_, i) =>
      createElementRef(String(i))
    );

    // Build list: 0 -> 1 -> 2 -> 3 -> 4
    // Start with first node
    nodes[0]!.prev = null;
    nodes[0]!.next = null;

    // Link each subsequent node to the end
    for (let i = 1; i < nodes.length; i++) {
      const prevNode = nodes[i - 1]!;
      const currentNode = nodes[i]!;

      currentNode.prev = prevNode;
      currentNode.next = null;
      prevNode.next = currentNode;
    }

    expect(validateLinkedList(nodes[0])).toBe(true);
    expect(countLinkedNodes(nodes[0])).toBe(5);

    // Remove middle node: 0 -> 1 -> 3 -> 4
    unlink(nodes[2]!);

    expect(validateLinkedList(nodes[0])).toBe(true);
    expect(countLinkedNodes(nodes[0])).toBe(4);
    expect(nodes[1]?.next).toBe(nodes[3]);

    // Add it back: 0 -> 1 -> 2 -> 3 -> 4
    linkBefore(nodes[2]!, nodes[3]);

    expect(validateLinkedList(nodes[0])).toBe(true);
    expect(countLinkedNodes(nodes[0])).toBe(5);

    // Verify structure
    const node1 = nodes[1];
    const node2 = nodes[2];
    expect(node1?.next).toBe(node2);
    expect(node2?.next).toBe(nodes[3]);
  });
});
