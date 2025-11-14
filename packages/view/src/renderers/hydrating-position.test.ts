/**
 * Tests for coordinate-based hydration position system
 *
 * This test suite formalizes the mathematical rules for tree traversal
 * during hydration without depending on DOM implementation details.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Type System
// ============================================================================

type TreePath = number[];

interface PointPosition {
  type: 'point';
  path: TreePath;
}

interface RangePosition {
  type: 'range';
  parentPath: TreePath;
  startIndex: number;
  endIndex: number;
  currentIndex: number;
}

type Position = PointPosition | RangePosition;

// ============================================================================
// Pure Position Transformations
// ============================================================================

/**
 * Enter an element's children (descend into tree)
 * Rule: Append 0 to current path to point at first child
 */
function enterElement(pos: Position): Position {
  const currentPath = pos.type === 'point'
    ? pos.path
    : [...pos.parentPath, pos.currentIndex];

  return {
    type: 'point',
    path: [...currentPath, 0]
  };
}

/**
 * Move to next sibling (horizontal movement)
 * Rule: Increment last component of path
 */
function advanceToSibling(pos: Position): Position {
  if (pos.type === 'point') {
    const newPath = [...pos.path];
    newPath[newPath.length - 1]++;
    return { type: 'point', path: newPath };
  } else {
    return { ...pos, currentIndex: pos.currentIndex + 1 };
  }
}

/**
 * Exit back to parent (ascend in tree)
 * Rule: Remove last component of path
 *
 * Special case: If exiting brings us back to a range's parent path + currentIndex,
 * we should return a range position with incremented currentIndex
 */
function exitToParent(pos: Position, activeRange?: RangePosition): Position {
  if (pos.type === 'point') {
    const newPath = pos.path.slice(0, -1);

    // Check if we're exiting back to a range level
    if (activeRange &&
        newPath.length === activeRange.parentPath.length + 1 &&
        newPath[newPath.length - 1] === activeRange.currentIndex) {
      // We're exiting an element in a range - return to range with next index
      return { ...activeRange, currentIndex: activeRange.currentIndex + 1 };
    }

    return { type: 'point', path: newPath };
  } else {
    // Exiting an element inside a range - advance within range
    return { ...pos, currentIndex: pos.currentIndex + 1 };
  }
}

/**
 * Enter fragment range mode
 * Rule: Switch from point to range, preserving parent context
 */
function enterFragmentRange(
  pos: PointPosition,
  rangeSize: number
): RangePosition {
  return {
    type: 'range',
    parentPath: pos.path,
    startIndex: 0,
    endIndex: rangeSize - 1,
    currentIndex: 0
  };
}

/**
 * Exit fragment range mode
 * Rule: Move to position after the range
 */
function exitFragmentRange(pos: RangePosition): PointPosition {
  const newPath = [...pos.parentPath];
  newPath[newPath.length - 1]++;
  return {
    type: 'point',
    path: newPath
  };
}

// ============================================================================
// Position Queries
// ============================================================================

function isAtRangeStart(pos: Position): boolean {
  return pos.type === 'range' && pos.currentIndex === pos.startIndex;
}

function isAtRangeEnd(pos: Position): boolean {
  return pos.type === 'range' && pos.currentIndex === pos.endIndex;
}

function isInRange(pos: Position): boolean {
  return pos.type === 'range';
}

function getCurrentPath(pos: Position): TreePath {
  if (pos.type === 'point') {
    return pos.path;
  } else {
    return [...pos.parentPath, pos.currentIndex];
  }
}

// ============================================================================
// Tests: Point Position Transformations
// ============================================================================

describe('Point Position Transformations', () => {
  it('should enter element from root', () => {
    const pos: PointPosition = { type: 'point', path: [] };
    const result = enterElement(pos);

    expect(result).toEqual({ type: 'point', path: [0] });
  });

  it('should enter element from nested position', () => {
    const pos: PointPosition = { type: 'point', path: [0, 2] };
    const result = enterElement(pos);

    expect(result).toEqual({ type: 'point', path: [0, 2, 0] });
  });

  it('should advance to next sibling', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1, 2] };
    const result = advanceToSibling(pos);

    expect(result).toEqual({ type: 'point', path: [0, 1, 3] });
  });

  it('should exit to parent', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1, 2] };
    const result = exitToParent(pos);

    expect(result).toEqual({ type: 'point', path: [0, 1] });
  });

  it('should exit from root child to root', () => {
    const pos: PointPosition = { type: 'point', path: [0] };
    const result = exitToParent(pos);

    expect(result).toEqual({ type: 'point', path: [] });
  });
});

// ============================================================================
// Tests: Fragment Range Transformations
// ============================================================================

describe('Fragment Range Transformations', () => {
  it('should enter fragment range', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1] };
    const result = enterFragmentRange(pos, 3);

    expect(result).toEqual({
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 0
    });
  });

  it('should advance within fragment range', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 0
    };
    const result = advanceToSibling(pos);

    expect(result).toEqual({
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1
    });
  });

  it('should exit fragment range', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 2
    };
    const result = exitFragmentRange(pos);

    expect(result).toEqual({ type: 'point', path: [0, 2] });
  });

  it('should enter element within fragment range', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1
    };
    const result = enterElement(pos);

    // Entering element at index 1 of range
    expect(result).toEqual({ type: 'point', path: [0, 1, 1, 0] });
  });

  it('should exit element within fragment range', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1
    };
    const result = exitToParent(pos);

    // Exiting element advances within range
    expect(result).toEqual({
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 2
    });
  });
});

// ============================================================================
// Tests: Position Queries
// ============================================================================

describe('Position Queries', () => {
  it('should detect range start', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 0
    };

    expect(isAtRangeStart(pos)).toBe(true);
  });

  it('should detect range end', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 2
    };

    expect(isAtRangeEnd(pos)).toBe(true);
  });

  it('should detect in range', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1
    };

    expect(isInRange(pos)).toBe(true);
  });

  it('should get current path for point position', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1, 2] };

    expect(getCurrentPath(pos)).toEqual([0, 1, 2]);
  });

  it('should get current path for range position', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0, 1],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1
    };

    expect(getCurrentPath(pos)).toEqual([0, 1, 1]);
  });
});

// ============================================================================
// Tests: Traversal Scenarios
// ============================================================================

describe('Tree Traversal Scenarios', () => {
  it('should traverse simple tree: div > (button, p)', () => {
    // el('div')(el('button')('Click'), el('p')('Text'))

    let pos: Position = { type: 'point', path: [] };

    // createElement('div') - enter container's first child
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0]); // Now at div's first child position

    // createElement('button') - enter button
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]); // Now at button's first child position

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

    let pos: Position = { type: 'point', path: [] };

    // createElement('ul')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0]); // At ul's first child

    // Encounter fragment-start marker - enter range mode
    pos = enterFragmentRange(pos as PointPosition, 3);
    let activeRange = pos as RangePosition;
    expect(isInRange(pos)).toBe(true);
    expect(getCurrentPath(pos)).toEqual([0, 0]); // First item in range

    // createElement('li') - first item
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0]); // li's first child

    // createTextNode('1')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1]);

    // appendChild(li, text) - exit li, should return to range
    pos = exitToParent(pos, activeRange);
    if (pos.type === 'range') activeRange = pos; // Update activeRange
    expect(getCurrentPath(pos)).toEqual([0, 1]); // Advanced to next range item

    // createElement('li') - second item
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1, 0]); // Second li's first child

    // createTextNode('2')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 1, 1]);

    // appendChild(li, text) - exit li, should return to range
    pos = exitToParent(pos, activeRange);
    if (pos.type === 'range') activeRange = pos; // Update activeRange
    expect(getCurrentPath(pos)).toEqual([0, 2]); // Advanced to next range item

    // createElement('li') - third item
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 2, 0]); // Third li's first child

    // createTextNode('3')
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 2, 1]);

    // appendChild(li, text) - exit li, should return to range
    pos = exitToParent(pos, activeRange);
    if (pos.type === 'range') activeRange = pos; // Update activeRange
    expect(isAtRangeEnd(pos)).toBe(false); // currentIndex is now 3, end is 2
    expect(getCurrentPath(pos)).toEqual([0, 3]); // Past end

    // Exit fragment range
    pos = exitFragmentRange(pos as RangePosition);
    expect(getCurrentPath(pos)).toEqual([1]); // Next sibling of ul
  });

  it('should handle nested elements in fragment', () => {
    // map([items])(item => el('div')(el('span')(item)))

    let pos: Position = { type: 'point', path: [] };

    // Enter fragment at container level
    pos = enterFragmentRange(pos as PointPosition, 2);
    let activeRange = pos as RangePosition;
    expect(getCurrentPath(pos)).toEqual([0]); // First item in range

    // First item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]); // Div's first child

    // createElement('span')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 0]); // Span's first child

    // createTextNode
    pos = advanceToSibling(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0, 1]);

    // appendChild(span, text) - exit span (no activeRange since we're nested)
    pos = exitToParent(pos);
    expect(getCurrentPath(pos)).toEqual([0, 0]); // Back in div

    // appendChild(div, span) - exit div within range
    pos = exitToParent(pos, activeRange);
    if (pos.type === 'range') activeRange = pos; // Update activeRange
    expect(getCurrentPath(pos)).toEqual([1]); // Advanced to next range item

    // Second item: createElement('div')
    pos = enterElement(pos);
    expect(getCurrentPath(pos)).toEqual([1, 0]); // Second div's first child
  });
});

// ============================================================================
// Tests: Invariants
// ============================================================================

describe('Position Transformation Invariants', () => {
  it('should satisfy: exit(enter(pos)) leaves pos at same depth', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1] };
    const entered = enterElement(pos);
    const exited = exitToParent(entered);

    expect(exited.path.length).toBe(pos.path.length);
  });

  it('should satisfy: enter always increases path depth by 1', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1, 2] };
    const result = enterElement(pos);

    expect(result.path.length).toBe(pos.path.length + 1);
  });

  it('should satisfy: exit always decreases path depth by 1', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1, 2] };
    const result = exitToParent(pos);

    expect(result.path.length).toBe(pos.path.length - 1);
  });

  it('should satisfy: sibling advance preserves path depth', () => {
    const pos: PointPosition = { type: 'point', path: [0, 1, 2] };
    const result = advanceToSibling(pos);

    expect(result.path.length).toBe(pos.path.length);
  });

  it('should satisfy: range position always has valid current index', () => {
    const pos: RangePosition = {
      type: 'range',
      parentPath: [0],
      startIndex: 0,
      endIndex: 2,
      currentIndex: 1
    };

    expect(pos.currentIndex).toBeGreaterThanOrEqual(pos.startIndex);
    expect(pos.currentIndex).toBeLessThanOrEqual(pos.endIndex + 1); // Can be one past end
  });
});
