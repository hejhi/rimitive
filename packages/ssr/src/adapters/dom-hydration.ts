/**
 * Coordinate-Based Hydrating DOM Adapter
 *
 * Uses explicit tree coordinates and range tracking instead of
 * imperative cursor manipulation. More algorithmic, easier to reason about.
 *
 * Key improvements:
 * - Position is explicit TreePath + RangeStack, not implicit cursor state
 * - appendChild uses DOM state to detect exit (child.parentNode check)
 * - Fragment ranges are scanned and tracked explicitly
 * - All position transformations are pure functions
 *
 * Async fragment data is embedded in fragment-start markers as base64 JSON:
 *   <!--fragment-start:eyJkYXRhIjoiLi4uIn0=-->
 * During hydration, this data is extracted and injected into async fragments.
 */

import type { Adapter, NodeRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { STATUS_FRAGMENT } from '@lattice/view/types';
import { isAsyncFragment, ASYNC_FRAGMENT } from '@lattice/view/load';
import {
  type Position,
  type TreePath,
  enterElement,
  exitToParent,
  advanceToSibling,
  enterFragmentRange,
  getCurrentPath,
  positionFromPath,
} from '../deps/hydrate-dom';

// Re-export DOMAdapterConfig for consumers that import from here
export type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

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
 * Handles both regular markers and markers with embedded data:
 *   <!--fragment-start-->
 *   <!--fragment-start:BASE64DATA-->
 *   <!--fragment-end-->
 */
function isFragmentMarker(node: Node): boolean {
  if (node.nodeType !== 8) return false; // Not a comment
  const text = (node as Comment).textContent ?? '';
  return (
    text === 'fragment-start' ||
    text.startsWith('fragment-start:') ||
    text === 'fragment-end'
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
 * Check if a comment is a fragment-start marker (with or without data)
 */
function isFragmentStartMarker(node: Node): boolean {
  if (node.nodeType !== 8) return false;
  const text = (node as Comment).textContent ?? '';
  return text === 'fragment-start' || text.startsWith('fragment-start:');
}

/**
 * Extract embedded data from a fragment-start marker
 * Returns undefined if no data is embedded
 */
function extractMarkerData(node: Node): unknown | undefined {
  if (node.nodeType !== 8) return undefined;
  const text = (node as Comment).textContent ?? '';
  if (!text.startsWith('fragment-start:')) return undefined;

  const base64 = text.slice('fragment-start:'.length);
  try {
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    // Invalid base64 or JSON - treat as no data
    return undefined;
  }
}

/**
 * Scan forward from fragment-start marker to count range size
 * Returns null if node is not a fragment-start marker
 */
function scanFragmentRange(node: Node): number | null {
  if (!isFragmentStartMarker(node)) {
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
 * Check if node is a fragment-start marker (with or without data)
 */
function isFragmentStart(node: Node | null): boolean {
  return node !== null && isFragmentStartMarker(node);
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
 * Result of finding fragment content - includes index and optional marker node
 */
type FragmentSearchResult = {
  index: number;
  markerNode: Node;
} | null;

/**
 * Find the child index where fragment content starts
 * Scans backwards from nextSibling to find fragment-start marker
 *
 * Handles adjacent fragments: if nextSiblingElement is inside a fragment
 * (preceded by fragment-start), we need to skip that entire fragment first.
 *
 * Returns null if no fragment markers are found (fragment was hidden during SSR)
 * Returns index and marker node if found (marker may contain embedded data)
 */
function findFragmentContent(
  parentElement: Element,
  nextSiblingElement: Element | null
): FragmentSearchResult {
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

  return { index, markerNode: node };
}

// ============================================================================
// Adapter Implementation
// ============================================================================

/**
 * Create a DOM hydration adapter for rehydrating server-rendered content
 */
export function createDOMHydrationAdapter(
  containerEl: HTMLElement
): Adapter<DOMAdapterConfig> {
  // Position tracks where we are in the tree (empty = at root before entering)
  let position: Position = { path: null, depth: 0, ranges: null };

  return {
    /**
     * Create or return existing node
     */
    createNode: (type, props) => {
      // Handle text nodes
      if (type === 'text') {
        const node = getNodeAtPath(containerEl, getCurrentPath(position));

        if (node.nodeType !== 3) {
          throw new HydrationMismatch(
            `Expected text node at ${getCurrentPath(position).join('/')}, got ${node.nodeName}`
          );
        }

        const textNode = node as Text;
        const text = (props?.value as string) || '';

        // Update text if it differs (handles data races)
        if (textNode.textContent !== text) {
          textNode.textContent = text;
        }

        // Advance to next sibling
        position = advanceToSibling(position);

        return textNode;
      }

      // Handle element nodes
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
          (firstNode as Element).tagName.toLowerCase() !== type.toLowerCase()
        ) {
          throw new HydrationMismatch(
            `Expected <${type}> as first item in fragment, got <${(firstNode as Element).tagName}>`
          );
        }

        // Enter this element's children
        position = enterElement(position);
        return firstNode as HTMLElement;
      }

      // Regular element
      if (
        node.nodeType !== 1 ||
        (node as Element).tagName.toLowerCase() !== type.toLowerCase()
      ) {
        throw new HydrationMismatch(
          `Expected <${type}> at ${getCurrentPath(position).join('/')}, got <${(node as Element).tagName}>`
        );
      }

      // Enter this element's children
      position = enterElement(position);
      return node as HTMLElement;
    },

    /**
     * Set property on node
     */
    setProperty: (node: Node, key: string, value: unknown) => {
      // Handle text nodes
      if (node.nodeType === 3 && key === 'value') {
        node.textContent = String(value);
        return;
      }

      // Handle element properties
      Reflect.set(node, key, value);
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
     * Lifecycle: onCreate
     *
     * For fragments: Skip past fragment content during forward pass. Advances position
     * past the fragment's content so subsequent siblings can be matched correctly.
     */
    onCreate: (ref: NodeRef<Node>, parentElement) => {
      // Only handle fragments - elements don't need special handling during hydration
      if (ref.status !== STATUS_FRAGMENT) return;

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
     * Lifecycle: beforeAttach
     *
     * For fragments: Seek to fragment position for deferred content hydration.
     * Computes position from DOM structure before creating deferred content.
     *
     * For async fragments: Extract embedded data from marker and inject it.
     * This prevents re-fetching data that was already fetched during SSR.
     */
    beforeAttach: (ref: NodeRef<Node>, parentElement, nextSiblingElement) => {
      // Only handle fragments - elements don't need special handling during hydration
      if (ref.status !== STATUS_FRAGMENT) return;

      // Find fragment content - includes marker node for data extraction
      const result = findFragmentContent(
        parentElement as HTMLElement,
        nextSiblingElement as HTMLElement
      );

      // No fragment markers found - fragment was hidden during SSR
      // This is expected for match() with initially-null result
      // No-op: position doesn't need to change since there's no content to hydrate
      if (result === null) {
        return;
      }

      const { index: childIndex, markerNode } = result;

      // If this is an async fragment, extract and inject embedded data
      if (isAsyncFragment(ref)) {
        const data = extractMarkerData(markerNode);
        if (data !== undefined) {
          // Inject data into async fragment - prevents re-fetching
          ref[ASYNC_FRAGMENT].setData(data);
        }
      }

      // Compute path from root to parent element
      const parentPath = computePathToElement(
        containerEl,
        parentElement as HTMLElement
      );

      // Set position to point at fragment content
      position = positionFromPath([...parentPath, childIndex]);
    },
  };
}
