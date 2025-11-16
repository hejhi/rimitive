/**
 * Tests for doubly-linked list manipulation helpers
 */

import { describe, it, expect } from 'vitest';
import { linkBefore, unlink, getNextElement, getPrevElement } from './linked-list';
import { STATUS_ELEMENT, STATUS_COMMENT } from '../types';
import type { ElementRef, CommentRef } from '../types';
import { validateLinkedList, linkedListToArray, countLinkedNodes } from '../test-helpers';

// Test helpers to create mock nodes
function createElementRef<T>(element: T): ElementRef<T> {
  return {
    status: STATUS_ELEMENT,
    element,
    prev: null,
    next: null,
  };
}

function createCommentRef(data: string): CommentRef {
  return {
    status: STATUS_COMMENT,
    data,
    element: { comment: data },
    prev: null,
    next: null,
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

  it('should handle linking comments and elements', () => {
    const elem1 = createElementRef('div');
    const comment = createCommentRef('marker');
    const elem2 = createElementRef('span');

    // Create list: elem1 -> comment -> elem2
    linkBefore(elem1, null);
    linkBefore(comment, null);
    linkBefore(elem2, null);

    elem1.next = comment;
    comment.prev = elem1;
    comment.next = elem2;
    elem2.prev = comment;

    expect(validateLinkedList(elem1)).toBe(true);
    expect(countLinkedNodes(elem1)).toBe(3);

    const allNodes = linkedListToArray(elem1);
    expect(allNodes[0]!.status).toBe(STATUS_ELEMENT);
    expect(allNodes[1]!.status).toBe(STATUS_COMMENT);
    expect(allNodes[2]!.status).toBe(STATUS_ELEMENT);
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

  it('should skip comments and find next element', () => {
    const elem1 = createElementRef('div');
    const comment1 = createCommentRef('marker1');
    const comment2 = createCommentRef('marker2');
    const elem2 = createElementRef('span');

    // Create list: elem1 -> comment1 -> comment2 -> elem2
    elem1.next = comment1;
    comment1.prev = elem1;
    comment1.next = comment2;
    comment2.prev = comment1;
    comment2.next = elem2;
    elem2.prev = comment2;

    expect(getNextElement(elem1)).toBe(elem1);
    expect(getNextElement(comment1)).toBe(elem2);
    expect(getNextElement(comment2)).toBe(elem2);
  });

  it('should return undefined when no element found', () => {
    const comment = createCommentRef('marker');

    expect(getNextElement(comment)).toBe(undefined);
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

  it('should skip comments and find previous element', () => {
    const elem1 = createElementRef('div');
    const comment1 = createCommentRef('marker1');
    const comment2 = createCommentRef('marker2');
    const elem2 = createElementRef('span');

    // Create list: elem1 -> comment1 -> comment2 -> elem2
    elem1.next = comment1;
    comment1.prev = elem1;
    comment1.next = comment2;
    comment2.prev = comment1;
    comment2.next = elem2;
    elem2.prev = comment2;

    expect(getPrevElement(elem2)).toBe(elem2);
    expect(getPrevElement(comment2)).toBe(elem1);
    expect(getPrevElement(comment1)).toBe(elem1);
  });

  it('should return undefined when no element found', () => {
    const comment = createCommentRef('marker');

    expect(getPrevElement(comment)).toBe(undefined);
  });
});

describe('integration tests', () => {
  it('should maintain list integrity through multiple operations', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => createElementRef(String(i)));

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

  it('should handle mixed element and comment lists', () => {
    const elem1 = createElementRef('div');
    const comment1 = createCommentRef('start');
    const elem2 = createElementRef('span');
    const comment2 = createCommentRef('end');

    // Build: elem1 -> comment1 -> elem2 -> comment2
    linkBefore(elem1, null);
    linkBefore(comment1, null);
    linkBefore(elem2, null);
    linkBefore(comment2, null);

    elem1.next = comment1;
    comment1.prev = elem1;
    comment1.next = elem2;
    elem2.prev = comment1;
    elem2.next = comment2;
    comment2.prev = elem2;

    expect(validateLinkedList(elem1)).toBe(true);
    expect(countLinkedNodes(elem1)).toBe(4);

    // Find next element from comment1
    expect(getNextElement(comment1)).toBe(elem2);

    // Find prev element from comment2
    expect(getPrevElement(comment2)).toBe(elem2);

    // Unlink elem2
    unlink(elem2);

    expect(validateLinkedList(elem1)).toBe(true);
    expect(comment1.next).toBe(comment2);
    expect(comment2.prev).toBe(comment1);
    expect(getNextElement(comment1)).toBe(undefined);
  });
});
