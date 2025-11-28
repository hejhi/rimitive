/**
 * Coordinate-Based Hydrating DOM Renderer
 *
 * Uses explicit tree coordinates and range tracking instead of
 * imperative cursor manipulation. More algorithmic, easier to reason about.
 *
 * Key improvements:
 * - Position is explicit TreePath + RangeStack, not implicit cursor state
 * - appendChild uses DOM state to detect exit (child.parentNode check)
 * - Fragment ranges are scanned and tracked explicitly
 * - All position transformations are pure functions
 */

import type { Renderer } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import {
  type Position,
  type TreePath,
  enterElement,
  exitToParent,
  advanceToSibling,
  enterFragmentRange,
  getCurrentPath,
  positionFromPath,
} from '../helpers/hydrate-dom';

// Re-export DOMRendererConfig for consumers that import from here
export type { DOMRendererConfig } from '@lattice/view/renderers/dom';

/**
 * Hydration mismatch error
 */
export class HydrationMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

// ============================================================================
// DOM Navigation Utilities
// ============================================================================

/**
 * Check if node is a fragment marker comment
 */
function isFragmentMarker(node: Node): boolean {
  if (node.nodeType !== 8) return false; // Not a comment
  const comment = node as Comment;
  return (
    comment.textContent === 'fragment-start' ||
    comment.textContent === 'fragment-end'
  );
}

/**
 * Get the Nth real child of a parent, skipping fragment markers
 */
function getNthRealChild(parent: Node, index: number): Node {
  let count = 0;
  let current = parent.firstChild;

  while (current) {
    if (!isFragmentMarker(current)) {
      if (count === index) return current;
      count++;
    }
    current = current.nextSibling;
  }

  throw new HydrationMismatch(
    `Child at index ${index} not found (found ${count} children)`
  );
}

/**
 * Resolve a tree path to an actual DOM node
 */
function getNodeAtPath(root: HTMLElement, path: TreePath): Node {
  let node: Node = root;

  for (const index of path) {
    node = getNthRealChild(node, index);
  }

  return node;
}

/**
 * Scan forward from fragment-start marker to count range size
 * Returns null if node is not a fragment-start marker
 */
function scanFragmentRange(node: Node): number | null {
  if (
    node.nodeType !== 8 ||
    (node as Comment).textContent !== 'fragment-start'
  ) {
    return null;
  }

  let current = node.nextSibling;
  let count = 0;

  while (current) {
    // Found end marker
    if (
      current.nodeType === 8 &&
      (current as Comment).textContent === 'fragment-end'
    ) {
      return count;
    }

    // Count real nodes (skip other comments)
    if (!isFragmentMarker(current)) {
      count++;
    }

    current = current.nextSibling;
  }

  throw new HydrationMismatch(
    'Fragment start marker without matching end marker'
  );
}

/**
 * Check if node is a fragment-start marker
 */
function isFragmentStart(node: Node | null): boolean {
  return (
    node !== null &&
    node.nodeType === 8 &&
    (node as Comment).textContent === 'fragment-start'
  );
}

/**
 * Check if node is a fragment-end marker
 */
function isFragmentEnd(node: Node | null): boolean {
  return (
    node !== null &&
    node.nodeType === 8 &&
    (node as Comment).textContent === 'fragment-end'
  );
}

/**
 * Compute the tree path from root to target element
 * Walks up DOM counting siblings (skipping markers) at each level
 */
function computePathToElement(root: Element, target: Element): TreePath {
  const path: number[] = [];
  let current: Node = target;

  while (current !== root && current.parentNode) {
    const parent = current.parentNode;

    // Count real siblings before current
    let index = 0;
    let sibling = parent.firstChild;
    while (sibling && sibling !== current) {
      if (!isFragmentMarker(sibling)) index++;
      sibling = sibling.nextSibling;
    }

    path.unshift(index);
    current = parent as Element;
  }

  return path;
}

/**
 * Find the child index where fragment content starts
 * Scans backwards from nextSibling to find fragment-start marker
 *
 * Handles adjacent fragments: if nextSiblingElement is inside a fragment
 * (preceded by fragment-start), we need to skip that entire fragment first.
 *
 * Returns null if no fragment markers are found (fragment was hidden during SSR)
 */
function findFragmentContentIndex(
  parentElement: Element,
  nextSiblingElement: Element | null
): number | null {
  // Step 1: Find the starting point for backwards scan
  let node: Node | null = nextSiblingElement
    ? nextSiblingElement.previousSibling
    : parentElement.lastChild;

  // Check if nextSiblingElement is the first element of a fragment
  // (its previousSibling would be fragment-start)
  // In that case, we need to skip past that fragment to find the PREVIOUS one
  if (nextSiblingElement && node && isFragmentStart(node)) {
    // nextSiblingElement is inside a fragment, skip past that fragment's start marker
    node = node.previousSibling;
  }

  // Skip past fragment-end markers
  while (isFragmentEnd(node)) {
    node = node!.previousSibling;
  }

  // Skip past content to find fragment-start
  while (node && !isFragmentStart(node)) {
    node = node.previousSibling;
  }

  // No fragment markers found - fragment was hidden during SSR (e.g., match() returned null)
  if (!node) {
    return null;
  }

  // Step 2: Count real children before fragment-start
  let index = 0;
  let current = parentElement.firstChild;
  while (current && current !== node) {
    if (!isFragmentMarker(current)) index++;
    current = current.nextSibling;
  }

  return index;
}

// ============================================================================
// Renderer Implementation
// ============================================================================

export function createDOMHydrationRenderer(
  containerEl: HTMLElement
): Renderer<DOMRendererConfig> {
  // Position tracks where we are in the tree (empty = at root before entering)
  let position: Position = { path: null, depth: 0, ranges: null };

  return {
    /**
     * Return existing element and enter its children
     */
    createElement: (tag) => {
      const node = getNodeAtPath(containerEl, getCurrentPath(position));

      // Check if we're at a fragment marker
      const rangeSize = scanFragmentRange(node);
      if (rangeSize !== null) {
        // Enter fragment range mode
        position = enterFragmentRange(position, rangeSize);

        // Get first element in range
        const firstNode = getNodeAtPath(containerEl, getCurrentPath(position));

        if (
          firstNode.nodeType !== 1 ||
          (firstNode as Element).tagName.toLowerCase() !== tag.toLowerCase()
        ) {
          throw new HydrationMismatch(
            `Expected <${tag}> as first item in fragment, got <${(firstNode as Element).tagName}>`
          );
        }

        // Enter this element's children
        position = enterElement(position);
        return firstNode as HTMLElement;
      }

      // Regular element
      if (
        node.nodeType !== 1 ||
        (node as Element).tagName.toLowerCase() !== tag.toLowerCase()
      ) {
        throw new HydrationMismatch(
          `Expected <${tag}> at ${getCurrentPath(position).join('/')}, got <${(node as Element).tagName}>`
        );
      }

      // Enter this element's children
      position = enterElement(position);
      return node as HTMLElement;
    },

    /**
     * Return existing text node and advance to next sibling
     */
    createTextNode: (text) => {
      const node = getNodeAtPath(containerEl, getCurrentPath(position));

      if (node.nodeType !== 3) {
        throw new HydrationMismatch(
          `Expected text node at ${getCurrentPath(position).join('/')}, got ${node.nodeName}`
        );
      }

      const textNode = node as Text;

      // Update text if it differs (handles data races)
      if (textNode.textContent !== text) {
        textNode.textContent = text;
      }

      // Advance to next sibling
      position = advanceToSibling(position);

      return textNode;
    },

    /**
     * Update text node content
     */
    updateTextNode: (node, text) => {
      node.textContent = text;
    },

    /**
     * Set attribute/property on element
     */
    setAttribute: (element, key, value) => {
      Reflect.set(element, key, value);
    },

    /**
     * Position bookkeeping - detects element exit by checking DOM state
     *
     * During hydration, child is already attached to parent.
     * If we see appendChild(parent, element) where element.parentNode === parent,
     * this signals we've finished processing that element's children.
     */
    appendChild: (parent, child) => {
      // Check if child is an element already attached to parent
      if (
        child &&
        'nodeType' in child &&
        (child as Node).nodeType === 1 && // Element node
        (child as Node).parentNode === parent
      ) {
        // Element already in DOM - this is exit signal
        position = exitToParent(position);
        position = advanceToSibling(position);
      }

      // No actual DOM operation - child already in place
    },

    /**
     * No-op during hydration - removal happens after hydration completes
     */
    removeChild: () => {},

    /**
     * Position bookkeeping during insertBefore
     *
     * Used by map() helper to insert elements. Like appendChild, we detect
     * element boundaries by checking if child is already attached to parent.
     */
    insertBefore: (parent, child) => {
      // Check if child is an element already attached to parent
      if (
        child &&
        'nodeType' in child &&
        (child as Node).nodeType === 1 && // Element node
        (child as Node).parentNode === parent
      ) {
        position = exitToParent(position);
        position = advanceToSibling(position);
      }

      // No actual DOM operation - child already in place
    },

    /**
     * Check if element is connected to DOM
     */
    isConnected: (element) => element.isConnected,

    /**
     * Attach event listeners to hydrated elements
     */
    addEventListener: (element, event, handler, options) => {
      element.addEventListener(event, handler, options);
      return () =>
        element.removeEventListener(
          event,
          handler,
          options as AddEventListenerOptions
        );
    },

    /**
     * Skip past fragment content during forward pass
     *
     * Called when processChildren encounters a FragmentRef. Advances position
     * past the fragment's content so subsequent siblings can be matched correctly.
     */
    skipFragment: (parentElement) => {
      const currentPath = getCurrentPath(position);
      if (currentPath.length === 0) return;

      const childIndex = currentPath[currentPath.length - 1];
      if (childIndex === undefined) return;

      // Find the node at current position
      let count = 0;
      let node: Node | null = parentElement.firstChild;

      while (node && count < childIndex) {
        if (!isFragmentMarker(node)) count++;
        node = node.nextSibling;
      }

      // Skip any fragment markers to find the actual node
      while (node && isFragmentMarker(node) && !isFragmentStart(node)) {
        node = node.nextSibling;
      }

      // If we're at a fragment-start, scan to find fragment-end and count content
      if (node && isFragmentStart(node)) {
        let contentCount = 0;
        let current: Node | null = node.nextSibling;

        while (current && !isFragmentEnd(current)) {
          if (!isFragmentMarker(current)) contentCount++;
          current = current.nextSibling;
        }

        // Advance position past the fragment content
        const newPathArray = [
          ...currentPath.slice(0, -1),
          childIndex + contentCount,
        ];
        position = positionFromPath(newPathArray);
      }
    },

    /**
     * Seek to fragment position for deferred content hydration
     *
     * Called by fragment-creating primitives during attach() phase,
     * before creating deferred content. Computes position from DOM structure.
     */
    seekToFragment: (parentElement, nextSiblingElement) => {
      // Find child index where fragment content starts
      const childIndex = findFragmentContentIndex(
        parentElement,
        nextSiblingElement
      );

      // No fragment markers found - fragment was hidden during SSR
      // This is expected for match() with initially-null result
      // No-op: position doesn't need to change since there's no content to hydrate
      if (childIndex === null) {
        return;
      }

      // Compute path from root to parent element
      const parentPath = computePathToElement(containerEl, parentElement);

      // Set position to point at fragment content
      position = positionFromPath([...parentPath, childIndex]);
    },
  };
}
