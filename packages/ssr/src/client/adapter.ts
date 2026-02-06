/**
 * Client Adapters for Hydration
 *
 * Provides adapters for rehydrating server-rendered content.
 */

import type {
  Adapter,
  TreeConfig,
  NodeRef,
  NodeOf,
} from '@rimitive/view/types';
import type { DOMTreeConfig } from '@rimitive/view/adapters/dom';
import { STATUS_FRAGMENT } from '@rimitive/view/types';
import {
  isAsyncFragment,
  triggerAsyncFragment,
  type AsyncFragment,
} from '../shared/async-fragments';

export type { DOMTreeConfig } from '@rimitive/view/adapters/dom';

// =============================================================================
// HydrationMismatch Error
// =============================================================================

export class HydrationMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

// =============================================================================
// Fragment Marker Utilities
// =============================================================================

/** Check if node is any fragment marker comment */
function isMarker(node: Node | null): boolean {
  if (!node || node.nodeType !== 8) return false;
  const t = node.textContent ?? '';
  return (
    t === 'fragment-start' ||
    t === 'fragment-end' ||
    t.startsWith('async:') ||
    t.startsWith('/async:')
  );
}

/** Check if node is a fragment-start marker */
function isStartMarker(node: Node | null): boolean {
  if (!node || node.nodeType !== 8) return false;
  const t = node.textContent ?? '';
  return t === 'fragment-start' || t.startsWith('async:');
}

/** Check if node is a fragment-end marker */
function isEndMarker(node: Node | null): boolean {
  if (!node || node.nodeType !== 8) return false;
  const t = node.textContent ?? '';
  return t === 'fragment-end' || t.startsWith('/async:');
}

// =============================================================================
// DOM Navigation
// =============================================================================

/** Get Nth real child, skipping fragment markers */
function getNthChild(parent: Node, index: number): Node {
  let count = 0;
  let node = parent.firstChild;
  while (node) {
    if (!isMarker(node)) {
      if (count === index) return node;
      count++;
    }
    node = node.nextSibling;
  }
  throw new HydrationMismatch(
    `Child at index ${index} not found (found ${count} children)`
  );
}

/** Resolve path to DOM node */
function getNodeAtPath(root: Node, path: number[]): Node {
  let node = root;
  for (const index of path) node = getNthChild(node, index);
  return node;
}

/** Count real siblings before target (skipping markers) */
function countSiblingsBefore(parent: Node, target: Node): number {
  let count = 0;
  let node = parent.firstChild;
  while (node && node !== target) {
    if (!isMarker(node)) count++;
    node = node.nextSibling;
  }
  return count;
}

/** Compute path from root to element */
function computePath(root: Element, target: Element): number[] {
  const path: number[] = [];
  let node: Node = target;
  while (node !== root && node.parentNode) {
    path.unshift(countSiblingsBefore(node.parentNode, node));
    node = node.parentNode;
  }
  return path;
}

/** Find fragment-start marker before nextSibling, return child index or null */
function findFragmentIndex(
  parent: Element,
  nextSibling: Element | null
): number | null {
  // Walk backwards from nextSibling to find fragment-start
  let node = nextSibling ? nextSibling.previousSibling : parent.lastChild;

  // Skip if nextSibling is preceded by a fragment-start (adjacent fragments)
  if (nextSibling && node && isStartMarker(node)) node = node.previousSibling;

  // Skip fragment-end markers
  while (isEndMarker(node)) node = node!.previousSibling;

  // Find fragment-start
  while (node && !isStartMarker(node)) node = node.previousSibling;

  if (!node) return null; // No markers - fragment hidden during SSR

  // Count real children before the marker
  return countSiblingsBefore(parent, node);
}

/** Count items in fragment range starting at marker */
function countFragmentItems(startMarker: Node): number {
  let count = 0;
  let node = startMarker.nextSibling;
  while (node && !isEndMarker(node)) {
    if (!isMarker(node)) count++;
    node = node.nextSibling;
  }
  return count;
}

// =============================================================================
// DOM Hydration Adapter
// =============================================================================

export function createDOMHydrationAdapter(
  containerEl: HTMLElement
): Adapter<DOMTreeConfig> {
  // Mutable position - path[i] is child index at depth i
  const path: number[] = [];

  // Track the last element that triggered an exit (to prevent double-counting)
  // This handles cases where both appendChild and insertBefore are called
  // for the same element (e.g., in map fragment items)
  let lastExitedElement: Node | null = null;

  // Track fragment parent and base path for map item creation.
  // Map creates multiple items before calling insertBefore, so we need to
  // reset to the base path before each item creation.
  let fragmentParent: Element | null = null;
  let fragmentBasePath: number[] = [];
  let fragmentNextIndex = 0;

  /**
   * Exit from an element back to its parent level.
   *
   * The path may be deep inside the element's descendants (because el.ts
   * creates all descendants before calling appendChild). We need to restore
   * the path to the parent's level, pointing to the next sibling position.
   */
  function exitToParent(parent: Node, child: Node): void {
    if (child === lastExitedElement) return;
    lastExitedElement = child;

    // Compute what the path should be after exiting child:
    // - Path to parent + (child's sibling index + 1)
    const parentPath = computePath(containerEl, parent as Element);
    const childIndex = countSiblingsBefore(parent, child);

    path.length = 0;
    path.push(...parentPath, childIndex + 1);

    // If this is a fragment child, update the next index
    if (parent === fragmentParent) {
      fragmentNextIndex = childIndex + 1;
    }
  }

  return {
    createNode: (type, props) => {
      // Text nodes
      if (type === 'text') {
        // For text nodes inside fragments, check if we need to reset path
        if (fragmentParent && path.length > fragmentBasePath.length + 1) {
          try {
            getNodeAtPath(containerEl, path);
            // Path is valid, continue
          } catch {
            // Path is invalid - try fragment reset
            const testPath = [...fragmentBasePath, fragmentNextIndex];
            try {
              const testNode = getNodeAtPath(containerEl, testPath);
              if (testNode.nodeType === 3) {
                path.length = 0;
                path.push(...testPath);
                path[path.length - 1] = (path[path.length - 1] ?? 0) + 1;
                return testNode;
              }
            } catch {
              // Reset path also invalid
            }
          }
        }
        const node = getNodeAtPath(containerEl, path);
        if (node.nodeType !== 3) {
          throw new HydrationMismatch(
            `Expected text node at ${path.join('/')}, got ${node.nodeName}`
          );
        }
        const text = (props?.value as string) ?? '';
        if (node.textContent !== text) node.textContent = text;
        path[path.length - 1] = (path[path.length - 1] ?? 0) + 1;
        return node;
      }

      // Element nodes
      // For direct fragment children (path.length === fragmentBasePath.length + 1),
      // track the index so we know where we are for subsequent items.
      if (
        fragmentParent &&
        path.length === fragmentBasePath.length + 1 &&
        path[path.length - 1] === fragmentNextIndex
      ) {
        // We're creating a direct fragment child at the expected position
        // Update fragmentNextIndex for the next item
        fragmentNextIndex++;
      }

      // For elements deeper inside fragments, check if path is valid first.
      // If not, try resetting to fragment base path (handles map items created
      // before insertBefore is called).
      if (fragmentParent && path.length > fragmentBasePath.length + 1) {
        let currentPathValid = false;
        try {
          const testNode = getNodeAtPath(containerEl, path);
          if (
            testNode.nodeType === 1 &&
            (testNode as Element).tagName.toLowerCase() === type.toLowerCase()
          ) {
            currentPathValid = true;
          }
        } catch {
          // Current path is invalid
        }

        if (!currentPathValid) {
          // Current path is invalid - try finding the next fragment child
          // Start from fragmentNextIndex and search forward
          for (let i = fragmentNextIndex; i < 100; i++) {
            const resetPath = [...fragmentBasePath, i];
            try {
              const resetNode = getNodeAtPath(containerEl, resetPath);
              if (
                resetNode.nodeType === 1 &&
                (resetNode as Element).tagName.toLowerCase() === type.toLowerCase()
              ) {
                // Found the right element - reset path
                path.length = 0;
                path.push(...resetPath);
                path.push(0); // Enter element's children
                // Update fragmentNextIndex for the next item
                fragmentNextIndex = i + 1;
                return resetNode;
              }
            } catch {
              // This index doesn't exist - stop searching
              break;
            }
          }
        }
      }

      const node = getNodeAtPath(containerEl, path);
      if (
        node.nodeType !== 1 ||
        (node as Element).tagName.toLowerCase() !== type.toLowerCase()
      ) {
        throw new HydrationMismatch(
          `Expected <${type}> at ${path.join('/')}, got <${(node as Element).tagName}>`
        );
      }
      path.push(0); // Enter element's children
      return node;
    },

    setAttribute: (node, key, value) => {
      const n = node as Node;
      if (n.nodeType === 3 && key === 'value') {
        n.textContent = String(value);
        return;
      }
      Reflect.set(node, key, value);
    },

    appendChild: (parent, child) => {
      const c = child as Node;
      // Element already attached = exit signal
      if (c && c.nodeType === 1 && c.parentNode === parent) {
        exitToParent(parent as Node, c);
      }
    },

    removeChild: () => {}, // No-op during hydration

    insertBefore: (parent, child) => {
      const c = child as Node;
      // Element already attached = exit signal (same as appendChild)
      if (c && c.nodeType === 1 && c.parentNode === parent) {
        exitToParent(parent as Node, c);
      }
    },

    onCreate: (ref, parentElement) => {
      if (ref.status !== STATUS_FRAGMENT || path.length === 0) return;

      const childIndex = path[path.length - 1];
      if (childIndex === undefined) return;

      // Find node at current position
      const parent = parentElement as Node;
      let count = 0;
      let node = parent.firstChild;
      while (node && count < childIndex) {
        if (!isMarker(node)) count++;
        node = node.nextSibling;
      }

      // Skip non-start markers
      while (node && isMarker(node) && !isStartMarker(node)) {
        node = node.nextSibling;
      }

      // If at fragment-start, advance past content
      if (node && isStartMarker(node)) {
        path[path.length - 1] = childIndex + countFragmentItems(node);
      }
    },

    beforeAttach: (ref, parentElement, nextSiblingElement) => {
      if (ref.status !== STATUS_FRAGMENT) return;

      const index = findFragmentIndex(
        parentElement as HTMLElement,
        nextSiblingElement as HTMLElement
      );
      if (index === null) return; // Fragment hidden during SSR

      // Compute path from root to parent, then add fragment index
      const parentPath = computePath(containerEl, parentElement as HTMLElement);
      path.length = 0;
      path.push(...parentPath, index);

      // Set up fragment tracking for map item creation
      fragmentParent = parentElement as Element;
      fragmentBasePath = [...parentPath];
      fragmentNextIndex = index;
    },

    /**
     * Handle shadow root hydration for Declarative Shadow DOM.
     *
     * After DSD parsing, the host element has no light DOM children -
     * the content is in the shadow root. We return the existing shadow root
     * and let the normal element exit flow (appendChild) handle path management.
     */
    createShadowRoot: (host, options) => {
      const element = host as Element;
      const existingShadow = element.shadowRoot;

      if (existingShadow) {
        // Return existing shadow root from DSD
        // Don't pop path here - appendChild handles element exit
        return {
          container: existingShadow as unknown as DOMTreeConfig['nodes'][string],
          shadowRoot: existingShadow,
        };
      }

      // No existing shadow - create new one (client-side navigation)
      const shadowRoot = element.attachShadow({
        mode: options.mode,
        delegatesFocus: options.delegatesFocus,
      });

      return {
        container: shadowRoot as unknown as DOMTreeConfig['nodes'][string],
        shadowRoot,
      };
    },
  };
}

// =============================================================================
// Hydration Adapter (Mode Switching)
// =============================================================================

export function createHydrationAdapter(
  hydrateAdapter: Adapter<DOMTreeConfig>,
  fallbackAdapter: Adapter<DOMTreeConfig>
): Adapter<DOMTreeConfig> & { switchToFallback: () => void } {
  let a = hydrateAdapter;
  return {
    createNode: (type, props) => a.createNode(type, props),
    setAttribute: (node, key, value) => a.setAttribute(node, key, value),
    appendChild: (parent, child) => a.appendChild(parent, child),
    removeChild: (parent, child) => a.removeChild(parent, child),
    insertBefore: (parent, newNode, refNode) =>
      a.insertBefore(parent, newNode, refNode),
    beforeCreate: (type, props) => a.beforeCreate?.(type, props),
    onCreate: (ref, parent) => a.onCreate?.(ref, parent),
    beforeAttach: (ref, parent, next) => a.beforeAttach?.(ref, parent, next),
    onAttach: (ref, parent) => a.onAttach?.(ref, parent),
    beforeDestroy: (ref, parent) => a.beforeDestroy?.(ref, parent),
    onDestroy: (ref, parent) => a.onDestroy?.(ref, parent),
    createShadowRoot: (host, options) => {
      if (a.createShadowRoot) {
        return a.createShadowRoot(host, options);
      }
      // Fallback for adapters without createShadowRoot
      const element = host as Element;
      const existingShadow = element.shadowRoot;
      if (existingShadow) {
        return {
          container: existingShadow as DOMTreeConfig['nodes'][string],
          shadowRoot: existingShadow,
        };
      }
      const shadowRoot = element.attachShadow({
        mode: options.mode,
        delegatesFocus: options.delegatesFocus,
      });
      return {
        container: shadowRoot as unknown as DOMTreeConfig['nodes'][string],
        shadowRoot,
      };
    },
    switchToFallback: () => {
      a = fallbackAdapter;
    },
  };
}

// =============================================================================
// Async Support Wrapper
// =============================================================================

export function withAsyncSupport<TConfig extends TreeConfig>(
  adapter: Adapter<TConfig>
): Adapter<TConfig> {
  const originalOnAttach = adapter.onAttach;
  return {
    ...adapter,
    onAttach: (ref: NodeRef<NodeOf<TConfig>>, parent) => {
      originalOnAttach?.(ref, parent);
      if (isAsyncFragment(ref)) {
        triggerAsyncFragment(ref as AsyncFragment<NodeOf<TConfig>>);
      }
    },
  };
}
