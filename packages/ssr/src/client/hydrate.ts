/**
 * Hydration Position System
 *
 * Coordinate-based position system for hydration using the Tree Zipper pattern
 * with range stack extension for fragments.
 *
 * Uses linked lists for O(1) operations with structural sharing.
 */

// ============================================================================
// Type System - Linked List Based
// ============================================================================

/** Cons-cell for path - enables structural sharing */
export type PathNode = Readonly<{
  index: number;
  parent: PathNode | null;
}>;

/** Cons-cell for range stack */
export type RangeNode = Readonly<{
  parentPath: PathNode | null;
  parentDepth: number;
  startIndex: number;
  endIndex: number;
  currentIndex: number;
  prev: RangeNode | null;
}>;

export type Position = {
  readonly path: PathNode | null;
  readonly depth: number;
  readonly ranges: RangeNode | null;
};

// Legacy type alias for compatibility
export type TreePath = number[];

// ============================================================================
// Path Utilities
// ============================================================================

/** O(1) - create path node with given index and parent */
function cons(index: number, parent: PathNode | null): PathNode {
  return { index, parent };
}

/** Get index at current position (head of path) */
function head(path: PathNode | null): number {
  return path?.index ?? 0;
}

/** O(1) - get parent path (structural sharing) */
function tail(path: PathNode | null): PathNode | null {
  return path?.parent ?? null;
}

/** Update head index - O(1) allocation, shares tail */
function updateHead(path: PathNode | null, newIndex: number): PathNode {
  return { index: newIndex, parent: tail(path) };
}

// ============================================================================
// Pure Position Transformations - O(1) allocations
// ============================================================================

/**
 * Enter an element's children (descend into tree)
 * Rule: Append 0 to current path to point at first child
 *
 * Range stack is preserved during descent
 */
export function enterElement(pos: Position): Position {
  return {
    path: cons(0, pos.path),
    depth: pos.depth + 1,
    ranges: pos.ranges,
  };
}

/**
 * Move to next sibling (horizontal movement)
 *
 * If at range level: increment range.currentIndex
 * Otherwise: increment last path component
 */
export function advanceToSibling(pos: Position): Position {
  // Check if we're at any range level (check from innermost outward via linked list)
  let range = pos.ranges;
  while (range !== null) {
    if (pos.depth === range.parentDepth + 1) {
      // At this range level - advance within range
      const nextIndex = range.currentIndex + 1;
      return {
        path: cons(nextIndex, range.parentPath),
        depth: pos.depth,
        ranges: updateRangeCurrentIndex(pos.ranges, range, nextIndex),
      };
    }
    range = range.prev;
  }

  // Not at any range level - normal sibling advance
  return {
    path: updateHead(pos.path, head(pos.path) + 1),
    depth: pos.depth,
    ranges: pos.ranges,
  };
}

/**
 * Update currentIndex for a specific range in the stack
 * Rebuilds only the portion from target to top
 */
function updateRangeCurrentIndex(
  stack: RangeNode | null,
  target: RangeNode,
  newIndex: number
): RangeNode | null {
  if (stack === null) return null;
  if (stack === target) {
    return { ...stack, currentIndex: newIndex };
  }
  // Rebuild nodes above target
  return {
    ...stack,
    prev: updateRangeCurrentIndex(stack.prev, target, newIndex),
  };
}

/**
 * Exit back to parent (ascend in tree)
 *
 * If exiting from inside a range element back to range level: advance within range
 * If range is exhausted: pop range from stack and advance past it
 * Otherwise: normal ascent
 */
export function exitToParent(pos: Position): Position {
  const newPath = tail(pos.path);
  const newDepth = pos.depth - 1;

  // Check if we're exiting back to ANY range level (check from innermost outward)
  let range = pos.ranges;
  while (range !== null) {
    if (newDepth === range.parentDepth + 1) {
      // We just exited from inside a range element back to this range level
      const nextIndex = range.currentIndex + 1;

      // Check if we've exhausted this range
      if (nextIndex > range.endIndex) {
        // Exit range mode - pop this range and all deeper ranges from stack
        const prevRange = range.prev;

        if (range.parentDepth === 0) {
          // Root-level range - position after range
          return {
            path: cons(range.endIndex + 1, null),
            depth: 1,
            ranges: prevRange,
          };
        }
        // Nested range - advance past it in parent
        return {
          path: updateHead(range.parentPath, head(range.parentPath) + 1),
          depth: range.parentDepth,
          ranges: prevRange,
        };
      }

      // Stay in range, advance to next item
      return {
        path: cons(nextIndex, range.parentPath),
        depth: newDepth,
        ranges: updateRangeCurrentIndex(pos.ranges, range, nextIndex),
      };
    }
    range = range.prev;
  }

  // Normal exit - preserve range stack
  return { path: newPath, depth: newDepth, ranges: pos.ranges };
}

/**
 * Enter fragment range mode
 *
 * Pushes new range onto stack and positions at first item
 */
export function enterFragmentRange(pos: Position, rangeSize: number): Position {
  const newRange: RangeNode = {
    parentPath: pos.path,
    parentDepth: pos.depth,
    startIndex: 0,
    endIndex: rangeSize - 1,
    currentIndex: 0,
    prev: pos.ranges,
  };

  return {
    path: cons(0, pos.path),
    depth: pos.depth + 1,
    ranges: newRange,
  };
}

/**
 * Check if position is past range end
 */
export function isPastRangeEnd(pos: Position): boolean {
  if (pos.ranges === null) return false;
  return pos.ranges.currentIndex > pos.ranges.endIndex;
}

// ============================================================================
// Position Queries
// ============================================================================

export function isAtRangeStart(pos: Position): boolean {
  if (pos.ranges === null) return false;
  return pos.ranges.currentIndex === pos.ranges.startIndex;
}

export function isAtRangeEnd(pos: Position): boolean {
  if (pos.ranges === null) return false;
  return pos.ranges.currentIndex === pos.ranges.endIndex;
}

export function isInRange(pos: Position): boolean {
  if (pos.ranges === null) return false;
  return pos.ranges.currentIndex <= pos.ranges.endIndex;
}

export function getDepth(pos: Position): number {
  return pos.depth;
}

// ============================================================================
// Path Conversion Utilities
// ============================================================================

/**
 * Convert linked list path to array (only when needed for DOM access)
 * O(n) where n is path depth
 */
export function pathToArray(path: PathNode | null): TreePath {
  const result: number[] = [];
  let current = path;
  while (current !== null) {
    result.push(current.index);
    current = current.parent;
  }
  return result.reverse();
}

/**
 * Get current path as array
 */
export function getCurrentPath(pos: Position): TreePath {
  return pathToArray(pos.path);
}

/**
 * Create initial position at root
 */
export function createInitialPosition(): Position {
  return {
    path: cons(0, null),
    depth: 1,
    ranges: null,
  };
}

/**
 * Create position from array path (for testing/compatibility)
 */
export function positionFromPath(pathArray: TreePath): Position {
  let path: PathNode | null = null;
  // Build from beginning - cons prepends, so iterate forward to get correct order
  // For [0, 2]: cons(0, null) → cons(2, {0}) → { index: 2, parent: { index: 0 } }
  // This represents "current at 2, parent at 0" which is path [0, 2]
  for (let i = 0; i < pathArray.length; i++) {
    path = cons(pathArray[i]!, path);
  }
  return {
    path,
    depth: pathArray.length,
    ranges: null,
  };
}
