/**
 * Coordinate-based position system for hydration
 *
 * Based on Tree Zipper pattern with range stack extension for fragments.
 * Provides pure, testable transformations for tree traversal during hydration.
 */

// ============================================================================
// Type System
// ============================================================================

export type TreePath = number[];

export interface RangeContext {
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
export interface Position {
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
export function enterElement(pos: Position): Position {
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
export function advanceToSibling(pos: Position): Position {
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
export function exitToParent(pos: Position): Position {
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
export function enterFragmentRange(
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
export function isPastRangeEnd(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex > topRange.endIndex;
}

// ============================================================================
// Position Queries
// ============================================================================

export function isAtRangeStart(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex === topRange.startIndex;
}

export function isAtRangeEnd(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex === topRange.endIndex;
}

export function isInRange(pos: Position): boolean {
  if (pos.ranges.length === 0) return false;
  const topRange = pos.ranges[pos.ranges.length - 1]!;
  return topRange.currentIndex <= topRange.endIndex;
}

export function getCurrentPath(pos: Position): TreePath {
  return pos.path;
}

export function getDepth(pos: Position): number {
  return pos.path.length;
}
