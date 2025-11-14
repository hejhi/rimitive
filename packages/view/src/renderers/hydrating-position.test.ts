/**
 * Tests for coordinate-based hydration position system
 *
 * This test suite formalizes the mathematical rules for tree traversal
 * during hydration without depending on DOM implementation details.
 *
 * Based on Tree Zipper pattern with range extension for fragments.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Type System
// ============================================================================

type TreePath = number[];

interface RangeContext {
  parentPath: TreePath;
  startIndex: number;
  endIndex: number;
  currentIndex: number;
  depth: number;
}

/**
 * Position in tree - Tree Zipper with range stack
 *
 * When ranges is empty: normal point-based navigation
 * When ranges has items: traversing nested fragment ranges (stack)
 */
interface Position {
  path: TreePath;
  ranges: RangeContext[];
}

// ============================================================================
// Pure Position Transformations
// ============================================================================

/**
 * Enter an element's children (descend into tree)
 * Rule: Append 0 to current path to point at first child
 *
 * Range stack is preserved during descent
 */
function enterElement(pos: Position): Position {
  return {
    path: [...pos.path, 0],
    ranges: pos.ranges
  };
}

/**
 * Move to next sibling (horizontal movement)
 *
 * If at range level: increment range.currentIndex
 * Otherwise: increment last path component
 */
function advanceToSibling(pos: Position): Position {
  // Check if we're at any range level (check from innermost to outermost)
  for (let i = pos.ranges.length - 1; i >= 0; i--) {
    const range = pos.ranges[i]!;

    if (pos.path.length === range.parentPath.length + 1) {
      // At this range level - advance within range
      const newRanges = [...pos.ranges];
      newRanges[i] = {
        ...range,
        currentIndex: range.currentIndex + 1
      };

      return {
        path: [...range.parentPath, range.currentIndex + 1],
        ranges: newRanges
      };
    }
  }

  // Not at any range level - normal sibling advance
  const newPath = [...pos.path];
  newPath[newPath.length - 1]!++;
  return { path: newPath, ranges: pos.ranges };
}

/**
 * Exit back to parent (ascend in tree)
 *
 * If exiting from inside a range element back to range level: advance within range
 * If range is exhausted: pop range from stack and advance past it
 * Otherwise: normal ascent
 */
function exitToParent(pos: Position): Position {
  const newPath = pos.path.slice(0, -1);

  // Check if we're exiting back to ANY range level (check from innermost to outermost)
  for (let i = pos.ranges.length - 1; i >= 0; i--) {
    const range = pos.ranges[i]!;

    if (newPath.length === range.parentPath.length + 1) {
      // We just exited from inside a range element back to this range level
      const nextIndex = range.currentIndex + 1;

      // Check if we've exhausted this range
      if (nextIndex > range.endIndex) {
        // Exit range mode - pop this range and all deeper ranges from stack
        if (range.parentPath.length === 0) {
          // Root-level range - position after range
          return {
            path: [range.endIndex + 1],
            ranges: pos.ranges.slice(0, i)
          };
        } else {
          // Nested range - advance past it in parent
          const exitPath = [...range.parentPath];
          exitPath[exitPath.length - 1]!++;
          return {
            path: exitPath,
            ranges: pos.ranges.slice(0, i)
          };
        }
      }

      // Stay in range, advance to next item
      const newRanges = [...pos.ranges];
      newRanges[i] = { ...range, currentIndex: nextIndex };

      return {
        path: [...range.parentPath, nextIndex],
        ranges: newRanges
      };
    }
  }

  // Normal exit - preserve range stack
  return { path: newPath, ranges: pos.ranges };
}

/**
 * Enter fragment range mode
 *
 * Pushes new range onto stack and positions at first item
 */
function enterFragmentRange(
  pos: Position,
  rangeSize: number
): Position {
  const newRange: RangeContext = {
    parentPath: pos.path,
    startIndex: 0,
    endIndex: rangeSize - 1,
    currentIndex: 0,
    depth: pos.ranges.length
  };

  return {
    path: [...pos.path, 0],
    ranges: [...pos.ranges, newRange]  // Push onto stack
  };
}

/**
 * Check if position is past range end
 */
function isPastRangeEnd(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex > topRange.endIndex;
}

// ============================================================================
// Position Queries
// ============================================================================

function isAtRangeStart(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex === topRange.startIndex;
}

function isAtRangeEnd(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex === topRange.endIndex;
}

function isInRange(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex <= topRange.endIndex;
}

function getCurrentPath(pos: Position): TreePath {
  return pos.path;
}

function getDepth(pos: Position): number {
  return pos.path.length;
}

// ============================================================================
// Tests: Point Position Transformations
// ============================================================================

describe('Point Position Transformations', () => {
  it('should enter element from root', () => {
    const pos: Position = { path: [], ranges: [] };
    const result = enterElement(pos);

    expect(result).toEqual({ path: [0], ranges: [] });
  });

  it('should enter element from nested position', () => {
    const pos: Position = { path: [0, 2], ranges: [] };
    const result = enterElement(pos);

    expect(result).toEqual({ path: [0, 2, 0], ranges: [] });
  });

  it('should advance to next sibling', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };
    const result = advanceToSibling(pos);

    expect(result).toEqual({ path: [0, 1, 3], ranges: [] });
  });

  it('should exit to parent', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };
    const result = exitToParent(pos);

    expect(result).toEqual({ path: [0, 1], ranges: [] });
  });

  it('should exit from root child to root', () => {
    const pos: Position = { path: [0], ranges: [] };
    const result = exitToParent(pos);

    expect(result).toEqual({ path: [], ranges: [] });
  });
});

// ============================================================================
// Tests: Fragment Range Transformations
// ============================================================================

describe('Fragment Range Transformations', () => {
  it('should enter fragment range', () => {
    const pos: Position = { path: [0, 1], ranges: [] };
    const result = enterFragmentRange(pos, 3);

    expect(result).toEqual({
      path: [0, 1, 0],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 0,
        depth: 0
      }]
    });
  });

  it('should advance within fragment range', () => {
    const pos: Position = {
      path: [0, 1, 0],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 0,
        depth: 0
      }]
    };
    const result = advanceToSibling(pos);

    expect(result).toEqual({
      path: [0, 1, 1],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1,
        depth: 0
      }]
    });
  });

  it('should enter element within fragment range', () => {
    const pos: Position = {
      path: [0, 1, 1],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1,
        depth: 0
      }]
    };
    const result = enterElement(pos);

    expect(result).toEqual({
      path: [0, 1, 1, 0],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1,
        depth: 0
      }]
    });
  });

  it('should exit element within fragment range and advance', () => {
    const pos: Position = {
      path: [0, 1, 1, 0],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1,
        depth: 0
      }]
    };
    const result = exitToParent(pos);

    // Should exit to range level and advance to next item
    expect(result).toEqual({
      path: [0, 1, 2],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2,
        depth: 0
      }]
    });
  });

  it('should auto-exit range when past end', () => {
    const pos: Position = {
      path: [0, 1, 2, 0],
      ranges: [{
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2,
        depth: 0
      }]
    };
    const result = exitToParent(pos);

    // Exiting last item should advance past range end and auto-exit
    expect(result).toEqual({
      path: [0, 2],
      ranges: []
    });
  });
});

// ============================================================================
// Tests: Position Queries
// ============================================================================

describe('Position Queries', () => {
  it('should detect range start', () => {
    const pos: Position = {
      path: [0, 0],
      ranges: [{
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 0,
        depth: 0
      }]
    };

    expect(isAtRangeStart(pos)).toBe(true);
  });

  it('should detect range end', () => {
    const pos: Position = {
      path: [0, 2],
      ranges: [{
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2,
        depth: 0
      }]
    };

    expect(isAtRangeEnd(pos)).toBe(true);
  });

  it('should detect in range', () => {
    const pos: Position = {
      path: [0, 1],
      ranges: [{
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1,
        depth: 0
      }]
    };

    expect(isInRange(pos)).toBe(true);
  });

  it('should detect past range end', () => {
    const pos: Position = {
      path: [0, 3],
      ranges: [{
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 3,
        depth: 0
      }]
    };

    expect(isPastRangeEnd(pos)).toBe(true);
    expect(isInRange(pos)).toBe(false);
  });

  it('should get current path', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };

    expect(getCurrentPath(pos)).toEqual([0, 1, 2]);
  });

  it('should get depth', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };

    expect(getDepth(pos)).toBe(3);
  });
});

// ============================================================================
// Tests: Traversal Scenarios
// ============================================================================

describe('Tree Traversal Scenarios', () => {
  it('should traverse simple tree: div > (button, p)', () => {
    // el('div')(el('button')('Click'), el('p')('Text'))

    let pos: Position = { path: [], ranges: [] };

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
    // el('ul')(map([1,2,3])(item => el('li')(item)))

    let pos: Position = { path: [], ranges: [] };

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
    expect(pos.ranges).toEqual([]); // No longer in range
  });

  it('should handle nested elements in fragment', () => {
    // map([items])(item => el('div')(el('span')(item)))

    let pos: Position = { path: [], ranges: [] };

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
    // map(items)(item => el('div')(map(item.children)(child => el('span')(child))))

    let pos: Position = { path: [], ranges: [] };

    // Enter outer fragment (2 items)
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([0]);
    expect(pos.ranges.length).toBe(1);

    // First item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]);

    // Enter inner fragment (2 children) - NESTED!
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0]);
    expect(pos.ranges.length).toBe(2); // Two ranges on stack!

    // First child: createElement('span')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0, 0]);

    // createTextNode
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0, 1]);

    // appendChild(span, text) - exit span
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1]); // Advance within inner range
    expect(pos.ranges.length).toBe(2);

    // Second child: createElement('span')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1, 0]);

    // createTextNode
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1, 1]);

    // appendChild(span, text) - exit span, should exhaust inner range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1]); // Exited inner range, back to outer
    expect(pos.ranges.length).toBe(1); // Popped inner range!

    // appendChild(div, innerFragment) - exit div, advance in outer range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([1]); // Second item of outer range
    expect(pos.ranges.length).toBe(1);

    // Second outer item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([1, 0]);

    // Enter inner fragment again (2 children)
    pos = enterFragmentRange(pos, 2);
    expect(getCurrentPath(pos)).toEqual([1, 0, 0]);
    expect(pos.ranges.length).toBe(2);

    // Process inner items... (abbreviated)
    pos = enterElement(pos); // span
    pos = advanceToSibling(pos); // text
    pos = exitToParent(pos); // exit span, advance in inner range
    pos = enterElement(pos); // second span
    pos = advanceToSibling(pos); // text
    pos = exitToParent(pos); // exit span, exhaust inner range
    expect(getCurrentPath(pos)).toEqual([1, 1]); // Back to div
    expect(pos.ranges.length).toBe(1); // Popped inner range

    // appendChild(div, innerFragment) - exit div, exhaust outer range
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([2]); // Past outer range (endIndex was 1)
    expect(pos.ranges.length).toBe(0); // Popped outer range!
  });
});

// ============================================================================
// Tests: Invariants
// ============================================================================

describe('Position Transformation Invariants', () => {
  it('should satisfy: exit(enter(pos)) returns to same depth', () => {
    const pos: Position = { path: [0, 1], ranges: [] };
    const entered = enterElement(pos);
    const exited = exitToParent(entered);

    expect(getDepth(exited)).toBe(getDepth(pos));
  });

  it('should satisfy: enter always increases depth by 1', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };
    const result = enterElement(pos);

    expect(getDepth(result)).toBe(getDepth(pos) + 1);
  });

  it('should satisfy: exit always decreases depth by 1 (non-range)', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };
    const result = exitToParent(pos);

    expect(getDepth(result)).toBe(getDepth(pos) - 1);
  });

  it('should satisfy: sibling advance preserves depth (non-range)', () => {
    const pos: Position = { path: [0, 1, 2], ranges: [] };
    const result = advanceToSibling(pos);

    expect(getDepth(result)).toBe(getDepth(pos));
  });

  it('should satisfy: range context is preserved during descent', () => {
    const pos: Position = {
      path: [0, 1],
      ranges: [{
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1,
        depth: 0
      }]
    };
    const result = enterElement(pos);

    expect(result.ranges).toEqual(pos.ranges);
  });

  it('should satisfy: auto-exit range when currentIndex exceeds endIndex', () => {
    const pos: Position = {
      path: [0, 2, 0],  // Inside last element
      ranges: [{
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2,
        depth: 0
      }]
    };
    const result = exitToParent(pos);

    expect(result.ranges).toEqual([]); // Auto-exited
    expect(getCurrentPath(result)).toEqual([1]); // Advanced past range
  });
});
