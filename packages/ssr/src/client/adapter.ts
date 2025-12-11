/**
 * Client Adapters for Hydration
 *
 * Provides adapters for rehydrating server-rendered content:
 * - createDOMHydrationAdapter: Walks existing DOM during hydration
 * - createHydrationAdapter: Switches between hydration and normal mode
 * - withAsyncSupport: Triggers async fragments on attach
 */

import type { Adapter, AdapterConfig, NodeRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { STATUS_FRAGMENT } from '@lattice/view/types';
import {
  type Position,
  type TreePath,
  enterElement,
  exitToParent,
  advanceToSibling,
  enterFragmentRange,
  getCurrentPath,
  positionFromPath,
} from './hydrate';
import {
  isAsyncFragment,
  triggerAsyncFragment,
  type AsyncFragment,
} from '../shared/async-fragments';

// Re-export DOMAdapterConfig for consumers that import from here
export type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

// =============================================================================
// HydrationMismatch Error
// =============================================================================

/**
 * Hydration mismatch error
 */
export class HydrationMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

// =============================================================================
// DOM Navigation Utilities
// =============================================================================

/**
 * Check if node is a fragment marker comment (including async markers)
 */
function isFragmentMarker(node: Node): boolean {
  if (node.nodeType !== 8) return false; // Not a comment
  const text = (node as Comment).textContent ?? '';
  return (
    text === 'fragment-start' ||
    text === 'fragment-end' ||
    text.startsWith('async:') ||
    text.startsWith('/async:')
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
 * Check if a comment is a fragment-start marker (including async markers)
 */
function isFragmentStartMarker(node: Node): boolean {
  if (node.nodeType !== 8) return false;
  const text = (node as Comment).textContent ?? '';
  return text === 'fragment-start' || text.startsWith('async:');
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
    // Found end marker (regular or async)
    if (isFragmentEnd(current)) {
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
  return node !== null && isFragmentStartMarker(node);
}

/**
 * Check if node is a fragment-end marker (including async markers)
 */
function isFragmentEnd(node: Node | null): boolean {
  if (node === null || node.nodeType !== 8) return false;
  const text = (node as Comment).textContent ?? '';
  return text === 'fragment-end' || text.startsWith('/async:');
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
 * Result of finding fragment content - includes index and marker node
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
 * Returns index and marker node if found
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

// =============================================================================
// DOM Hydration Adapter
// =============================================================================

/**
 * Create a DOM hydration adapter for rehydrating server-rendered content
 *
 * @example
 * ```ts
 * import { createDOMHydrationAdapter, createHydrationAdapter } from '@lattice/ssr/client';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const hydrateAdapter = createDOMHydrationAdapter(container);
 * const adapter = createHydrationAdapter(hydrateAdapter, createDOMAdapter());
 * ```
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
        // Debug: show parent context
        const parent = node.parentNode;
        const siblings = parent
          ? Array.from(parent.childNodes)
              .map(
                (n, i) =>
                  `${i}: ${n.nodeType === 1 ? `<${(n as Element).tagName}>` : n.nodeType === 8 ? `<!--${(n as Comment).textContent}-->` : `"${n.textContent?.slice(0, 20)}..."`}`
              )
              .join(', ')
          : 'no parent';
        throw new HydrationMismatch(
          `Expected <${type}> at ${getCurrentPath(position).join('/')}, got <${(node as Element).tagName}>. Parent children: [${siblings}]`
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
     * Note: Async fragment data is managed by createLoader() - data is passed
     * via initialData option, not extracted from markers.
     */
    beforeAttach: (ref: NodeRef<Node>, parentElement, nextSiblingElement) => {
      // Only handle fragments - elements don't need special handling during hydration
      if (ref.status !== STATUS_FRAGMENT) return;

      // Find fragment content
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

      const { index: childIndex } = result;

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

// =============================================================================
// Hydration Adapter (Mode Switching)
// =============================================================================

/**
 * Create a hydration adapter that switches to a fallback after hydration is complete
 *
 * @example
 * ```typescript
 * import { createHydrationAdapter, createDOMHydrationAdapter } from '@lattice/ssr/client';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const domAdapter = createDOMAdapter();
 * const hydrateAdapter = createDOMHydrationAdapter(container);
 * const adapter = createHydrationAdapter(hydrateAdapter, domAdapter);
 *
 * // After hydration completes
 * adapter.switchToFallback();
 * ```
 */
export function createHydrationAdapter(
  hydrateAdapter: Adapter<DOMAdapterConfig>,
  fallbackAdapter: Adapter<DOMAdapterConfig>
): Adapter<DOMAdapterConfig> & { switchToFallback: () => void } {
  let useHydrating = true;

  const switchToFallback = () => {
    useHydrating = false;
  };
  const getAdapter = (): Adapter<DOMAdapterConfig> =>
    useHydrating ? hydrateAdapter : fallbackAdapter;

  return {
    createNode: (type: string, props?: Record<string, unknown>) =>
      getAdapter().createNode(type, props),
    setProperty: (node: Node, key: string, value: unknown) =>
      getAdapter().setProperty(node, key, value),
    appendChild: (parent, child) => getAdapter().appendChild(parent, child),
    removeChild: (parent, child) => getAdapter().removeChild(parent, child),
    insertBefore: (parent, newNode, refNode) =>
      getAdapter().insertBefore(parent, newNode, refNode),
    beforeCreate: (type: string, props?: Record<string, unknown>) =>
      getAdapter().beforeCreate?.(type, props),
    onCreate: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().onCreate?.(ref, parent),
    beforeAttach: (
      ref: NodeRef<Node>,
      parent: Node,
      nextSibling: Node | null
    ) => getAdapter().beforeAttach?.(ref, parent, nextSibling),
    onAttach: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().onAttach?.(ref, parent),
    beforeDestroy: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().beforeDestroy?.(ref, parent),
    onDestroy: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().onDestroy?.(ref, parent),
    switchToFallback,
  };
}

// =============================================================================
// Async Support Wrapper
// =============================================================================

/**
 * Wrap an adapter to trigger async fragments on attach.
 *
 * Use this for client-side rendering (not hydration) where async fragments
 * should immediately start fetching when attached to the DOM.
 *
 * For hydration, data is provided via createLoader(initialData) - the loader
 * seeds async fragments with SSR-resolved data to avoid re-fetching.
 *
 * @example
 * ```ts
 * import { withAsyncSupport } from '@lattice/ssr/client';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = withAsyncSupport(createDOMAdapter());
 * ```
 */
export function withAsyncSupport<TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>
): Adapter<TConfig> {
  const originalOnAttach = adapter.onAttach;

  return {
    ...adapter,
    onAttach: (ref: NodeRef<TConfig['baseElement']>, parent) => {
      originalOnAttach?.(ref, parent);
      if (isAsyncFragment(ref)) {
        triggerAsyncFragment(ref as AsyncFragment<TConfig['baseElement']>);
      }
    },
  };
}
