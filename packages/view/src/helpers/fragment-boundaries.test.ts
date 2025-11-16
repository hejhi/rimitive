/**
 * Tests for fragment boundary maintenance helpers
 */

import { describe, it, expect } from 'vitest';
import {
  addToFragment,
  removeFromFragment,
  isInFragmentRange,
  updateBoundariesAfterInsert,
  countFragmentNodes,
} from './fragment-boundaries';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_COMMENT } from '../types';
import type { ElementRef, FragmentRef, CommentRef } from '../types';

// Test helpers to create mock nodes
function createElementRef<T>(element: T): ElementRef<T> {
  return {
    status: STATUS_ELEMENT,
    element,
    parent: null,
    prev: null,
    next: null,
  };
}

function createCommentRef(data: string): CommentRef {
  return {
    status: STATUS_COMMENT,
    data,
    element: { comment: data },
    parent: null,
    prev: null,
    next: null,
  };
}

function createFragmentRef<T>(): FragmentRef<T> {
  return {
    status: STATUS_FRAGMENT,
    element: null,
    parent: null,
    prev: null,
    next: null,
    firstChild: undefined,
    lastChild: undefined,
    attach: () => {},
  };
}

// Helper to link nodes together
function linkNodes<T>(nodes: (ElementRef<T> | CommentRef)[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const nextNode = nodes[i + 1];
    const prevNode = nodes[i - 1];

    node.prev = prevNode ?? null;
    node.next = nextNode ?? null;
  }
}

describe('addToFragment', () => {
  it('should add first node to empty fragment', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    addToFragment(fragment, node, 'start');

    expect(fragment.firstChild).toBe(node);
    expect(fragment.lastChild).toBe(node);
  });

  it('should add node to start of fragment', () => {
    const fragment = createFragmentRef<string>();
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    // First node
    addToFragment(fragment, node1, 'start');
    expect(fragment.firstChild).toBe(node1);
    expect(fragment.lastChild).toBe(node1);

    // Add at start
    addToFragment(fragment, node2, 'start');
    expect(fragment.firstChild).toBe(node2);
    expect(fragment.lastChild).toBe(node1); // lastChild unchanged
  });

  it('should add node to end of fragment', () => {
    const fragment = createFragmentRef<string>();
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    // First node
    addToFragment(fragment, node1, 'end');
    expect(fragment.firstChild).toBe(node1);
    expect(fragment.lastChild).toBe(node1);

    // Add at end
    addToFragment(fragment, node2, 'end');
    expect(fragment.firstChild).toBe(node1); // firstChild unchanged
    expect(fragment.lastChild).toBe(node2);
  });

  it('should handle multiple additions', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    addToFragment(fragment, nodes[0]!, 'start');
    addToFragment(fragment, nodes[1]!, 'end');
    addToFragment(fragment, nodes[2]!, 'end');

    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[2]);
  });
});

describe('removeFromFragment', () => {
  it('should remove only node from fragment', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    fragment.firstChild = node;
    fragment.lastChild = node;

    removeFromFragment(fragment, node);

    expect(fragment.firstChild).toBe(undefined);
    expect(fragment.lastChild).toBe(undefined);
  });

  it('should remove first node from multi-node fragment', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    removeFromFragment(fragment, nodes[0]!);

    expect(fragment.firstChild).toBe(nodes[1]);
    expect(fragment.lastChild).toBe(nodes[2]);
  });

  it('should remove last node from multi-node fragment', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    removeFromFragment(fragment, nodes[2]!);

    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[1]);
  });

  it('should remove middle node (boundaries unchanged)', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    removeFromFragment(fragment, nodes[1]!);

    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[2]);
  });

  it('should handle removing from two-node fragment', () => {
    const fragment = createFragmentRef<string>();
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    linkNodes([node1, node2]);
    fragment.firstChild = node1;
    fragment.lastChild = node2;

    removeFromFragment(fragment, node1);

    expect(fragment.firstChild).toBe(node2);
    expect(fragment.lastChild).toBe(node2);
  });

  it('should clear fragment when removing last remaining node', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    fragment.firstChild = node;
    fragment.lastChild = node;

    removeFromFragment(fragment, node);

    expect(fragment.firstChild).toBe(undefined);
    expect(fragment.lastChild).toBe(undefined);
  });
});

describe('isInFragmentRange', () => {
  it('should return false for empty fragment', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    expect(isInFragmentRange(fragment, node)).toBe(false);
  });

  it('should return true for only node in fragment', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    fragment.firstChild = node;
    fragment.lastChild = node;

    expect(isInFragmentRange(fragment, node)).toBe(true);
  });

  it('should return true for first node', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    expect(isInFragmentRange(fragment, nodes[0]!)).toBe(true);
  });

  it('should return true for middle node', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    expect(isInFragmentRange(fragment, nodes[1]!)).toBe(true);
  });

  it('should return true for last node', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    expect(isInFragmentRange(fragment, nodes[2]!)).toBe(true);
  });

  it('should return false for node not in fragment', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];
    const outsideNode = createElementRef('d');

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[2];

    expect(isInFragmentRange(fragment, outsideNode)).toBe(false);
  });

  it('should handle mixed element and comment nodes', () => {
    const fragment = createFragmentRef<unknown>();
    const elem1 = createElementRef('div');
    const comment = createCommentRef('marker');
    const elem2 = createElementRef('span');

    linkNodes([elem1, comment, elem2]);
    fragment.firstChild = elem1;
    fragment.lastChild = elem2;

    expect(isInFragmentRange(fragment, elem1)).toBe(true);
    expect(isInFragmentRange(fragment, comment)).toBe(true);
    expect(isInFragmentRange(fragment, elem2)).toBe(true);
  });
});

describe('updateBoundariesAfterInsert', () => {
  it('should set boundaries for first node in empty fragment', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    updateBoundariesAfterInsert(fragment, node, undefined);

    expect(fragment.firstChild).toBe(node);
    expect(fragment.lastChild).toBe(node);
  });

  it('should update firstChild when inserting before current firstChild', () => {
    const fragment = createFragmentRef<string>();
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    fragment.firstChild = node1;
    fragment.lastChild = node1;

    updateBoundariesAfterInsert(fragment, node2, node1);

    expect(fragment.firstChild).toBe(node2);
    expect(fragment.lastChild).toBe(node1);
  });

  it('should update lastChild when inserting at end', () => {
    const fragment = createFragmentRef<string>();
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');

    fragment.firstChild = node1;
    fragment.lastChild = node1;

    updateBoundariesAfterInsert(fragment, node2, undefined);

    expect(fragment.firstChild).toBe(node1);
    expect(fragment.lastChild).toBe(node2);
  });

  it('should not update boundaries when inserting in middle', () => {
    const fragment = createFragmentRef<string>();
    const node1 = createElementRef('a');
    const node2 = createElementRef('b');
    const node3 = createElementRef('c');

    linkNodes([node1, node3]);
    fragment.firstChild = node1;
    fragment.lastChild = node3;

    updateBoundariesAfterInsert(fragment, node2, node3);

    expect(fragment.firstChild).toBe(node1);
    expect(fragment.lastChild).toBe(node3);
  });

  it('should handle multiple sequential insertions', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    // Insert first
    updateBoundariesAfterInsert(fragment, nodes[0]!, undefined);
    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[0]);

    // Insert at end
    updateBoundariesAfterInsert(fragment, nodes[1]!, undefined);
    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[1]);

    // Insert at end again
    updateBoundariesAfterInsert(fragment, nodes[2]!, undefined);
    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[2]);
  });
});

describe('countFragmentNodes', () => {
  it('should return 0 for empty fragment', () => {
    const fragment = createFragmentRef<string>();

    expect(countFragmentNodes(fragment)).toBe(0);
  });

  it('should return 1 for single-node fragment', () => {
    const fragment = createFragmentRef<string>();
    const node = createElementRef('a');

    fragment.firstChild = node;
    fragment.lastChild = node;

    expect(countFragmentNodes(fragment)).toBe(1);
  });

  it('should count multiple nodes', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
      createElementRef('d'),
    ];

    linkNodes(nodes);
    fragment.firstChild = nodes[0];
    fragment.lastChild = nodes[3];

    expect(countFragmentNodes(fragment)).toBe(4);
  });

  it('should count mixed element and comment nodes', () => {
    const fragment = createFragmentRef<unknown>();
    const elem1 = createElementRef('div');
    const comment1 = createCommentRef('marker1');
    const elem2 = createElementRef('span');
    const comment2 = createCommentRef('marker2');

    linkNodes([elem1, comment1, elem2, comment2]);
    fragment.firstChild = elem1;
    fragment.lastChild = comment2;

    expect(countFragmentNodes(fragment)).toBe(4);
  });

  it('should handle partial ranges', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
      createElementRef('d'),
      createElementRef('e'),
    ];

    linkNodes(nodes);

    // Fragment only contains middle 3 nodes
    fragment.firstChild = nodes[1];
    fragment.lastChild = nodes[3];

    expect(countFragmentNodes(fragment)).toBe(3);
  });
});

describe('integration tests', () => {
  it('should maintain fragment boundaries through add/remove operations', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('a'),
      createElementRef('b'),
      createElementRef('c'),
    ];

    linkNodes(nodes);

    // Add first node
    addToFragment(fragment, nodes[0]!, 'start');
    expect(countFragmentNodes(fragment)).toBe(1);
    expect(isInFragmentRange(fragment, nodes[0]!)).toBe(true);

    // Add second at end
    addToFragment(fragment, nodes[2]!, 'end');
    // Fragment now has boundaries at nodes[0] and nodes[2]
    // Since nodes are already linked [a,b,c], count will be 3
    expect(countFragmentNodes(fragment)).toBe(3); // Counts all nodes between firstChild and lastChild

    // Remove first node
    removeFromFragment(fragment, nodes[0]!);
    expect(fragment.firstChild).toBe(nodes[1]);
    expect(isInFragmentRange(fragment, nodes[0]!)).toBe(false);
  });

  it('should work with updateBoundariesAfterInsert in reconciliation scenario', () => {
    const fragment = createFragmentRef<string>();
    const nodes = [
      createElementRef('item-1'),
      createElementRef('item-2'),
      createElementRef('item-3'),
    ];

    linkNodes(nodes);

    // Simulate reconciliation: insert items one by one
    updateBoundariesAfterInsert(fragment, nodes[0]!, undefined);
    expect(fragment.firstChild).toBe(nodes[0]);
    expect(fragment.lastChild).toBe(nodes[0]);

    updateBoundariesAfterInsert(fragment, nodes[1]!, undefined);
    expect(fragment.lastChild).toBe(nodes[1]);

    updateBoundariesAfterInsert(fragment, nodes[2]!, undefined);
    expect(fragment.lastChild).toBe(nodes[2]);

    expect(countFragmentNodes(fragment)).toBe(3);
  });

  it('should handle nested fragment scenario', () => {
    const outerFragment = createFragmentRef<string>();
    const innerFragment = createFragmentRef<string>();

    const outerNodes = [
      createElementRef('outer-1'),
      createElementRef('outer-2'),
    ];

    const innerNodes = [
      createElementRef('inner-1'),
      createElementRef('inner-2'),
    ];

    // Setup outer fragment: outer-1 -> inner-1 -> inner-2 -> outer-2
    linkNodes([outerNodes[0]!, ...innerNodes, outerNodes[1]!]);

    outerFragment.firstChild = outerNodes[0];
    outerFragment.lastChild = outerNodes[1];

    innerFragment.firstChild = innerNodes[0];
    innerFragment.lastChild = innerNodes[1];

    expect(countFragmentNodes(outerFragment)).toBe(4);
    expect(countFragmentNodes(innerFragment)).toBe(2);

    expect(isInFragmentRange(outerFragment, innerNodes[0]!)).toBe(true);
    expect(isInFragmentRange(innerFragment, outerNodes[0]!)).toBe(false);
  });
});
