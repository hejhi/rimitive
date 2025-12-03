/**
 * Tests for coordinate-based hydration position system
 *
 * This test suite formalizes the mathematical rules for tree traversal
 * during hydration without depending on DOM implementation details.
 *
 * Based on Tree Zipper pattern with range extension for fragments.
 */

import { describe, it, expect } from 'vitest';
import {
  type Position,
  type PathNode,
  type RangeNode,
  enterElement,
  advanceToSibling,
  exitToParent,
  enterFragmentRange,
  isPastRangeEnd,
  isAtRangeStart,
  isAtRangeEnd,
  isInRange,
  getCurrentPath,
  getDepth,
  positionFromPath,
  pathToArray,
} from './hydrate-dom';

// ============================================================================
// Test Helpers
// ============================================================================

/** Create empty position (at root, before entering any element) */
function emptyPos(): Position {
  return { path: null, depth: 0, ranges: null };
}

/** Create position with path only (no ranges) */
function posWithPath(pathArray: number[]): Position {
  return positionFromPath(pathArray);
}

/** Create path linked list from array */
function pathFromArray(arr: number[]): PathNode | null {
  let path: PathNode | null = null;
  // Build forward: for [0, 1, 2], we want head=2, parent=1, grandparent=0
  // cons prepends, so iterate forward to get correct order
  for (let i = 0; i < arr.length; i++) {
    path = { index: arr[i]!, parent: path };
  }
  return path;
}

/** Create a position with a single range */
function posWithRange(
  pathArray: number[],
  parentPathArray: number[],
  startIndex: number,
  endIndex: number,
  currentIndex: number
): Position {
  const range: RangeNode = {
    parentPath: pathFromArray(parentPathArray),
    parentDepth: parentPathArray.length,
    startIndex,
    endIndex,
    currentIndex,
    prev: null,
  };
  return {
    path: pathFromArray(pathArray),
    depth: pathArray.length,
    ranges: range,
  };
}

/** Get range stack as array for easier assertions */
function getRangesArray(pos: Position): Array<{
  parentPath: number[];
  startIndex: number;
  endIndex: number;
  currentIndex: number;
}> {
  const result: Array<{
    parentPath: number[];
    startIndex: number;
    endIndex: number;
    currentIndex: number;
  }> = [];
  let range = pos.ranges;
  while (range !== null) {
    result.push({
      parentPath: pathToArray(range.parentPath),
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      currentIndex: range.currentIndex,
    });
    range = range.prev;
  }
  return result.reverse(); // Return in stack order (oldest first)
}

// ============================================================================
// Tests: Point Position Transformations
// ============================================================================

describe('Point Position Transformations', () => {
  it('should enter element from root', () => {
    const pos = emptyPos();
    const result = enterElement(pos);

    expect(getCurrentPath(result)).toEqual([0]);
    expect(getDepth(result)).toBe(1);
  });

  it('should enter element from nested position', () => {
    const pos = posWithPath([0, 2]);
    const result = enterElement(pos);

    expect(getCurrentPath(result)).toEqual([0, 2, 0]);
    expect(getDepth(result)).toBe(3);
  });

  it('should advance to next sibling', () => {
    const pos = posWithPath([0, 1, 2]);
    const result = advanceToSibling(pos);

    expect(getCurrentPath(result)).toEqual([0, 1, 3]);
    expect(getDepth(result)).toBe(3);
  });

  it('should exit to parent', () => {
    const pos = posWithPath([0, 1, 2]);
    const result = exitToParent(pos);

    expect(getCurrentPath(result)).toEqual([0, 1]);
    expect(getDepth(result)).toBe(2);
  });

  it('should exit from root child to root', () => {
    const pos = posWithPath([0]);
    const result = exitToParent(pos);

    expect(getCurrentPath(result)).toEqual([]);
    expect(getDepth(result)).toBe(0);
  });
});

// ============================================================================
// Tests: Fragment Range Transformations
// ============================================================================

describe('Fragment Range Transformations', () => {
  it('should enter fragment range', () => {
    const pos = posWithPath([0, 1]);
    const result = enterFragmentRange(pos, 3);

    expect(getCurrentPath(result)).toEqual([0, 1, 0]);
    expect(getDepth(result)).toBe(3);
    const ranges = getRangesArray(result);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 0,
    });
  });

  it('should advance within fragment range', () => {
    const pos = posWithRange([0, 1, 0], [0, 1], 0, 2, 0);
    const result = advanceToSibling(pos);

    expect(getCurrentPath(result)).toEqual([0, 1, 1]);
    const ranges = getRangesArray(result);
    expect(ranges[0]).toEqual({
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1,
    });
  });

  it('should enter element within fragment range', () => {
    const pos = posWithRange([0, 1, 1], [0, 1], 0, 2, 1);
    const result = enterElement(pos);

    expect(getCurrentPath(result)).toEqual([0, 1, 1, 0]);
    expect(getDepth(result)).toBe(4);
    // Range should be preserved
    const ranges = getRangesArray(result);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.currentIndex).toBe(1);
  });

  it('should exit element within fragment range and advance', () => {
    const pos = posWithRange([0, 1, 1, 0], [0, 1], 0, 2, 1);
    const result = exitToParent(pos);

    // Should exit to range level and advance to next item
    expect(getCurrentPath(result)).toEqual([0, 1, 2]);
    const ranges = getRangesArray(result);
    expect(ranges[0]).toEqual({
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 2,
    });
  });

  it('should auto-exit range when past end', () => {
    const pos = posWithRange([0, 1, 2, 0], [0, 1], 0, 2, 2);
    const result = exitToParent(pos);

    // Exiting last item should advance past range end and auto-exit
    expect(getCurrentPath(result)).toEqual([0, 2]);
    expect(result.ranges).toBe(null);
  });
});

// ============================================================================
// Tests: Position Queries
// ============================================================================

describe('Position Queries', () => {
  it('should detect range start', () => {
    const pos = posWithRange([0, 0], [0], 0, 2, 0);
    expect(isAtRangeStart(pos)).toBe(true);
  });

  it('should detect range end', () => {
    const pos = posWithRange([0, 2], [0], 0, 2, 2);
    expect(isAtRangeEnd(pos)).toBe(true);
  });

  it('should detect in range', () => {
    const pos = posWithRange([0, 1], [0], 0, 2, 1);
    expect(isInRange(pos)).toBe(true);
  });

  it('should detect past range end', () => {
    const pos = posWithRange([0, 3], [0], 0, 2, 3);
    expect(isPastRangeEnd(pos)).toBe(true);
    expect(isInRange(pos)).toBe(false);
  });

  it('should get current path', () => {
    const pos = posWithPath([0, 1, 2]);
    expect(getCurrentPath(pos)).toEqual([0, 1, 2]);
  });

  it('should get depth', () => {
    const pos = posWithPath([0, 1, 2]);
    expect(getDepth(pos)).toBe(3);
  });
});

// ============================================================================
// Tests: Traversal Scenarios
// ============================================================================

describe('Tree Traversal Scenarios', () => {
  it('should traverse simple tree: div > (button, p)', () => {
    // el('div')(el('button')('Click'), el('p')('Text'))

    let pos = emptyPos();

    // createElement('div') - enter container's first child
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0]);

    // createElement('button') - enter button
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]);

    // createTextNode('Click')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1]);

    // appendChild(button, text) - exit button
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0]);

    // appendChild(div, button) - button done, advance to next child of div
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([1]);

    // createElement('p')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([1, 0]);

    // createTextNode('Text')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([1, 1]);

    // appendChild(p, text) - exit p
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([1]);

    // appendChild(div, p) - exit to container level
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([]);
  });

  it('should traverse fragment: map 3 items', () => {
    // el('ul')(map([1,2,3], item => el('li')(item)))

    let pos = emptyPos();

    // createElement('ul')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0]);

    // Encounter fragment-start marker - enter range mode
    pos = enterFragmentRange(pos, 3);
    expect(isInRange(pos)).toBe(true);
    expect(getCurrentPath(pos)).toEqual([0, 0]);

    // createElement('li') - first item
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0]);

    // createTextNode('1')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1]);

    // appendChild(li, text) - exit li, should advance within range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1]); // Advanced to item 1
    expect(isInRange(pos)).toBe(true);

    // createElement('li') - second item
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1, 0]);

    // createTextNode('2')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1, 1]);

    // appendChild(li, text) - exit li
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 2]); // Advanced to item 2
    expect(isInRange(pos)).toBe(true);
    expect(isAtRangeEnd(pos)).toBe(true);

    // createElement('li') - third item (last)
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 2, 0]);

    // createTextNode('3')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 2, 1]);

    // appendChild(li, text) - exit li, should auto-exit range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([1]); // Exited range, next sibling of ul
    expect(pos.ranges).toBe(null); // No longer in range
  });

  it('should handle nested elements in fragment', () => {
    // map([items], item => el('div')(el('span')(item)))

    let pos = emptyPos();

    // Enter fragment at container level
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([0]);

    // First item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]);

    // createElement('span')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0]);

    // createTextNode
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1]);

    // appendChild(span, text) - exit span
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]); // Back in div

    // appendChild(div, span) - exit div, advance in range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([1]); // Advanced to second item
    expect(isInRange(pos)).toBe(true);

    // Second item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([1, 0]);
  });

  it('should handle nested fragments', () => {
    // map(items, item => el('div')(map(item.children, child => el('span')(child))))

    let pos = emptyPos();

    // Enter outer fragment (2 items)
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([0]);
    expect(getRangesArray(pos)).toHaveLength(1);

    // First item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]);

    // Enter inner fragment (2 children) - NESTED!
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0]);
    expect(getRangesArray(pos)).toHaveLength(2); // Two ranges on stack!

    // First child: createElement('span')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0, 0]);

    // createTextNode
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0, 1]);

    // appendChild(span, text) - exit span
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1]); // Advance within inner range
    expect(getRangesArray(pos)).toHaveLength(2);

    // Second child: createElement('span')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1, 0]);

    // createTextNode
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1, 1]);

    // appendChild(span, text) - exit span, should exhaust inner range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1]); // Exited inner range, back to outer
    expect(getRangesArray(pos)).toHaveLength(1); // Popped inner range!

    // appendChild(div, innerFragment) - exit div, advance in outer range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([1]); // Second item of outer range
    expect(getRangesArray(pos)).toHaveLength(1);

    // Second outer item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([1, 0]);

    // Enter inner fragment again (2 children)
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([1, 0, 0]);
    expect(getRangesArray(pos)).toHaveLength(2);

    // Process inner items... (abbreviated)
    pos = enterElement(pos); // span
    pos = advanceToSibling(pos); // text
    pos = exitToParent(pos); // exit span, advance in inner range
    pos = enterElement(pos); // second span
    pos = advanceToSibling(pos); // text
    pos = exitToParent(pos); // exit span, exhaust inner range
    expect(getCurrentPath(pos)).toEqual([1, 1]); // Back to div
    expect(getRangesArray(pos)).toHaveLength(1); // Popped inner range

    // appendChild(div, innerFragment) - exit div, exhaust outer range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([2]); // Past outer range (endIndex was 1)
    expect(getRangesArray(pos)).toHaveLength(0); // Popped outer range!
  });
});

// ============================================================================
// Tests: Invariants
// ============================================================================

describe('Position Transformation Invariants', () => {
  it('should satisfy: exit(enter(pos)) returns to same depth', () => {
    const pos = posWithPath([0, 1]);
    const entered = enterElement(pos);
    const exited = exitToParent(entered);

    expect(getDepth(exited)).toBe(getDepth(pos));
  });

  it('should satisfy: enter always increases depth by 1', () => {
    const pos = posWithPath([0, 1, 2]);
    const result = enterElement(pos);

    expect(getDepth(result)).toBe(getDepth(pos) + 1);
  });

  it('should satisfy: exit always decreases depth by 1 (non-range)', () => {
    const pos = posWithPath([0, 1, 2]);
    const result = exitToParent(pos);

    expect(getDepth(result)).toBe(getDepth(pos) - 1);
  });

  it('should satisfy: sibling advance preserves depth (non-range)', () => {
    const pos = posWithPath([0, 1, 2]);
    const result = advanceToSibling(pos);

    expect(getDepth(result)).toBe(getDepth(pos));
  });

  it('should satisfy: range context is preserved during descent', () => {
    const pos = posWithRange([0, 1], [0], 0, 2, 1);
    const result = enterElement(pos);

    // Range should be preserved
    const originalRanges = getRangesArray(pos);
    const resultRanges = getRangesArray(result);
    expect(resultRanges).toHaveLength(originalRanges.length);
    expect(resultRanges[0]!.currentIndex).toBe(originalRanges[0]!.currentIndex);
  });

  it('should satisfy: auto-exit range when currentIndex exceeds endIndex', () => {
    // Position inside last element of a range
    const pos = posWithRange([0, 2, 0], [0], 0, 2, 2);
    const result = exitToParent(pos);

    expect(result.ranges).toBe(null); // Auto-exited
    expect(getCurrentPath(result)).toEqual([1]); // Advanced past range
  });
});
