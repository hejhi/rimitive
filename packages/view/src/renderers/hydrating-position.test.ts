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
}

/**
 * Position in tree - self-contained with optional range context
 *
 * When range is null: normal point-based navigation
 * When range is set: currently traversing a fragment range
 */
interface Position {
  path: TreePath;
  range: RangeContext | null;
}

// ============================================================================
// Pure Position Transformations
// ============================================================================

/**
 * Enter an element's children (descend into tree)
 * Rule: Append 0 to current path to point at first child
 *
 * Range context is preserved during descent
 */
function enterElement(pos: Position): Position {
  return {
    path: [...pos.path, 0],
    range: pos.range
  };
}

/**
 * Move to next sibling (horizontal movement)
 *
 * If at range level: increment range.currentIndex
 * Otherwise: increment last path component
 */
function advanceToSibling(pos: Position): Position {
  if (pos.range) {
    const rangeLevel = pos.range.parentPath.length;

    // Check if we're at the range level (not inside a range element)
    if (pos.path.length === rangeLevel + 1) {
      // At range level - advance within range
      return {
        path: [...pos.range.parentPath, pos.range.currentIndex + 1],
        range: {
          ...pos.range,
          currentIndex: pos.range.currentIndex + 1
        }
      };
    }
  }

  // Not at range level or no range - normal sibling advance
  const newPath = [...pos.path];
  newPath[newPath.length - 1]++;
  return { path: newPath, range: pos.range };
}

/**
 * Exit back to parent (ascend in tree)
 *
 * If exiting from inside a range element back to range level: advance within range
 * Otherwise: normal ascent
 */
function exitToParent(pos: Position): Position {
  const newPath = pos.path.slice(0, -1);

  // Check if we're exiting back to the range level
  if (pos.range) {
    const rangeLevel = pos.range.parentPath.length;

    // If new path length is rangeLevel + 1, we're at range level after exit
    // This means we just exited from inside a range element
    if (newPath.length === rangeLevel + 1) {
      const nextIndex = pos.range.currentIndex + 1;

      // Check if we've exhausted the range
      if (nextIndex > pos.range.endIndex) {
        // Exit range mode - advance past range
        const exitPath = [...pos.range.parentPath];
        exitPath[exitPath.length - 1]++;
        return { path: exitPath, range: null };
      }

      // Stay in range, advance to next item
      return {
        path: [...pos.range.parentPath, nextIndex],
        range: { ...pos.range, currentIndex: nextIndex }
      };
    }
  }

  // Normal exit - preserve range context
  return { path: newPath, range: pos.range };
}

/**
 * Enter fragment range mode
 *
 * Sets range context and positions at first item
 */
function enterFragmentRange(
  pos: Position,
  rangeSize: number
): Position {
  return {
    path: [...pos.path, 0],
    range: {
      parentPath: pos.path,
      startIndex: 0,
      endIndex: rangeSize - 1,
      currentIndex: 0
    }
  };
}

/**
 * Check if position is past range end
 */
function isPastRangeEnd(pos: Position): boolean {
  return pos.range !== null && pos.range.currentIndex > pos.range.endIndex;
}

// ============================================================================
// Position Queries
// ============================================================================

function isAtRangeStart(pos: Position): boolean {
  return pos.range !== null && pos.range.currentIndex === pos.range.startIndex;
}

function isAtRangeEnd(pos: Position): boolean {
  return pos.range !== null && pos.range.currentIndex === pos.range.endIndex;
}

function isInRange(pos: Position): boolean {
  return pos.range !== null && pos.range.currentIndex <= pos.range.endIndex;
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
    const pos: Position = { path: [], range: null };
    const result = enterElement(pos);

    expect(result).toEqual({ path: [0], range: null });
  });

  it('should enter element from nested position', () => {
    const pos: Position = { path: [0, 2], range: null };
    const result = enterElement(pos);

    expect(result).toEqual({ path: [0, 2, 0], range: null });
  });

  it('should advance to next sibling', () => {
    const pos: Position = { path: [0, 1, 2], range: null };
    const result = advanceToSibling(pos);

    expect(result).toEqual({ path: [0, 1, 3], range: null });
  });

  it('should exit to parent', () => {
    const pos: Position = { path: [0, 1, 2], range: null };
    const result = exitToParent(pos);

    expect(result).toEqual({ path: [0, 1], range: null });
  });

  it('should exit from root child to root', () => {
    const pos: Position = { path: [0], range: null };
    const result = exitToParent(pos);

    expect(result).toEqual({ path: [], range: null });
  });
});

// ============================================================================
// Tests: Fragment Range Transformations
// ============================================================================

describe('Fragment Range Transformations', () => {
  it('should enter fragment range', () => {
    const pos: Position = { path: [0, 1], range: null };
    const result = enterFragmentRange(pos, 3);

    expect(result).toEqual({
      path: [0, 1, 0],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 0
      }
    });
  });

  it('should advance within fragment range', () => {
    const pos: Position = {
      path: [0, 1, 0],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 0
      }
    };
    const result = advanceToSibling(pos);

    expect(result).toEqual({
      path: [0, 1, 1],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1
      }
    });
  });

  it('should enter element within fragment range', () => {
    const pos: Position = {
      path: [0, 1, 1],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1
      }
    };
    const result = enterElement(pos);

    expect(result).toEqual({
      path: [0, 1, 1, 0],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1
      }
    });
  });

  it('should exit element within fragment range and advance', () => {
    const pos: Position = {
      path: [0, 1, 1, 0],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1
      }
    };
    const result = exitToParent(pos);

    // Should exit to range level and advance to next item
    expect(result).toEqual({
      path: [0, 1, 2],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2
      }
    });
  });

  it('should auto-exit range when past end', () => {
    const pos: Position = {
      path: [0, 1, 2, 0],
      range: {
        parentPath: [0, 1],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2
      }
    };
    const result = exitToParent(pos);

    // Exiting last item should advance past range end and auto-exit
    expect(result).toEqual({
      path: [0, 2],
      range: null
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
      range: {
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 0
      }
    };

    expect(isAtRangeStart(pos)).toBe(true);
  });

  it('should detect range end', () => {
    const pos: Position = {
      path: [0, 2],
      range: {
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2
      }
    };

    expect(isAtRangeEnd(pos)).toBe(true);
  });

  it('should detect in range', () => {
    const pos: Position = {
      path: [0, 1],
      range: {
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1
      }
    };

    expect(isInRange(pos)).toBe(true);
  });

  it('should detect past range end', () => {
    const pos: Position = {
      path: [0, 3],
      range: {
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 3
      }
    };

    expect(isPastRangeEnd(pos)).toBe(true);
    expect(isInRange(pos)).toBe(false);
  });

  it('should get current path', () => {
    const pos: Position = { path: [0, 1, 2], range: null };

    expect(getCurrentPath(pos)).toEqual([0, 1, 2]);
  });

  it('should get depth', () => {
    const pos: Position = { path: [0, 1, 2], range: null };

    expect(getDepth(pos)).toBe(3);
  });
});

// ============================================================================
// Tests: Traversal Scenarios
// ============================================================================

describe('Tree Traversal Scenarios', () => {
  it('should traverse simple tree: div > (button, p)', () => {
    // el('div')(el('button')('Click'), el('p')('Text'))

    let pos: Position = { path: [], range: null };

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

    let pos: Position = { path: [], range: null };

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
    expect(pos.range).toBe(null); // No longer in range
  });

  it('should handle nested elements in fragment', () => {
    // map([items])(item => el('div')(el('span')(item)))

    let pos: Position = { path: [], range: null };

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
});

// ============================================================================
// Tests: Invariants
// ============================================================================

describe('Position Transformation Invariants', () => {
  it('should satisfy: exit(enter(pos)) returns to same depth', () => {
    const pos: Position = { path: [0, 1], range: null };
    const entered = enterElement(pos);
    const exited = exitToParent(entered);

    expect(getDepth(exited)).toBe(getDepth(pos));
  });

  it('should satisfy: enter always increases depth by 1', () => {
    const pos: Position = { path: [0, 1, 2], range: null };
    const result = enterElement(pos);

    expect(getDepth(result)).toBe(getDepth(pos) + 1);
  });

  it('should satisfy: exit always decreases depth by 1 (non-range)', () => {
    const pos: Position = { path: [0, 1, 2], range: null };
    const result = exitToParent(pos);

    expect(getDepth(result)).toBe(getDepth(pos) - 1);
  });

  it('should satisfy: sibling advance preserves depth (non-range)', () => {
    const pos: Position = { path: [0, 1, 2], range: null };
    const result = advanceToSibling(pos);

    expect(getDepth(result)).toBe(getDepth(pos));
  });

  it('should satisfy: range context is preserved during descent', () => {
    const pos: Position = {
      path: [0, 1],
      range: {
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 1
      }
    };
    const result = enterElement(pos);

    expect(result.range).toEqual(pos.range);
  });

  it('should satisfy: auto-exit range when currentIndex exceeds endIndex', () => {
    const pos: Position = {
      path: [0, 2, 0],  // Inside last element
      range: {
        parentPath: [0],
        startIndex: 0,
        endIndex: 2,
        currentIndex: 2
      }
    };
    const result = exitToParent(pos);

    expect(result.range).toBe(null); // Auto-exited
    expect(getCurrentPath(result)).toEqual([1]); // Advanced past range
  });
});
