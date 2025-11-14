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

import type { Renderer, RendererConfig } from '../renderer';
import {
  type Position,
  type TreePath,
  enterElement,
  exitToParent,
  advanceToSibling,
  enterFragmentRange,
  getCurrentPath,
} from './hydrating-position';

/**
 * Hydration mismatch error
 */
export class HydrationMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

export interface DOMRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
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
  if (node.nodeType !== 8 || (node as Comment).textContent !== 'fragment-start') {
    return null;
  }

  let current = node.nextSibling;
  let count = 0;

  while (current) {
    // Found end marker
    if (current.nodeType === 8 && (current as Comment).textContent === 'fragment-end') {
      return count;
    }

    // Count real nodes (skip other comments)
    if (!isFragmentMarker(current)) {
      count++;
    }

    current = current.nextSibling;
  }

  throw new HydrationMismatch('Fragment start marker without matching end marker');
}

// ============================================================================
// Renderer Implementation
// ============================================================================

export function createHydratingDOMRenderer(
  containerEl: HTMLElement
): Renderer<DOMRendererConfig> {
  // Position tracks where we are in the tree
  let position: Position = { path: [], ranges: [] };

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
  };
}
