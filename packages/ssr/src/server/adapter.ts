/**
 * Server DOM Adapter
 *
 * Renders Lattice components to HTML strings using linkedom.
 * Adds fragment markers for hydration support.
 */

import { parseHTML } from 'linkedom';
import type { Adapter, FragmentRef, NodeRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import { isAsyncFragment } from '@lattice/view/load';

// =============================================================================
// Fragment Marker Utilities
// =============================================================================

/**
 * Get the first DOM node from a NodeRef (iteratively traversing nested fragments)
 */
export function getFirstDOMNode(nodeRef: NodeRef<unknown>): Node | null {
  let current: NodeRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current.element as Node;
    }
    if (current.status === STATUS_FRAGMENT) {
      current = current.firstChild;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Get the last DOM node from a NodeRef (iteratively traversing nested fragments)
 */
function getLastDOMNode(nodeRef: NodeRef<unknown>): Node | null {
  let current: NodeRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current.element as Node;
    }
    if (current.status === STATUS_FRAGMENT) {
      current = current.lastChild;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Insert markers for a fragment.
 *
 * parentElement is derived from the DOM tree - by the time we call this,
 * the content is already attached so we can get it from firstNode.parentNode.
 *
 * Note: Async fragment data is no longer embedded in markers. Use createLoader()
 * to manage data serialization separately.
 */
export function insertFragmentMarkers(fragment: FragmentRef<unknown>): void {
  if (!fragment.firstChild || !fragment.lastChild) return;

  const firstNode = getFirstDOMNode(fragment.firstChild);
  const lastNode = getLastDOMNode(fragment.lastChild);

  if (!firstNode || !lastNode) return;

  // Derive parentElement from the DOM tree - content is already attached
  const parentElement = firstNode.parentNode as HTMLElement | null;
  if (!parentElement) return;

  // Get document from parent element
  const doc = parentElement.ownerDocument;

  // Insert fragment-start comment before first child
  const startComment = doc.createComment('fragment-start');
  parentElement.insertBefore(startComment, firstNode);

  // Insert fragment-end comment after last child
  const endComment = doc.createComment('fragment-end');
  parentElement.insertBefore(endComment, lastNode.nextSibling);
}

// =============================================================================
// Server Adapter
// =============================================================================

/**
 * Serializer function type - converts an element to HTML string
 */
export type Serialize = (element: unknown) => string;

/**
 * Result from createDOMServerAdapter
 */
export type ServerAdapterResult = {
  /** The adapter for mounting components */
  adapter: Adapter<DOMAdapterConfig>;
  /** Serialize an element to HTML string */
  serialize: Serialize;
};

/**
 * Create a linkedom adapter for server-side rendering
 *
 * Returns an adapter for mounting components and a serialize function
 * for converting elements to HTML strings.
 *
 * @example
 * ```typescript
 * import { createDOMServerAdapter } from '@lattice/ssr/server';
 *
 * const { adapter, serialize } = createDOMServerAdapter();
 * // Use adapter for mounting, serialize for renderToString
 * ```
 */
export function createDOMServerAdapter(): ServerAdapterResult {
  // Create a document context for element creation
  const { document } = parseHTML('<!DOCTYPE html><html></html>');

  const adapter: Adapter<DOMAdapterConfig> = {
    createNode: (type: string, props?: Record<string, unknown>) => {
      if (type === 'text') {
        const textNode = document.createTextNode(
          (props?.value as string) || ''
        );
        return textNode;
      }
      return document.createElement(type);
    },
    setProperty: (node: Node, key: string, value: unknown) => {
      // Handle text nodes
      if (node.nodeType === 3 && key === 'value') {
        node.textContent = String(value);
        return;
      }

      const element = node as HTMLElement;
      // Skip event handlers during SSR (no interactivity on server)
      if (key.startsWith('on')) return;

      // Map JSX-style props to HTML attributes
      const attributeName = key === 'className' ? 'class' : key;

      // Use setAttribute for proper HTML attribute handling
      // linkedom automatically handles escaping and attribute normalization
      if (value != null && value !== false) {
        // Only stringify primitives, skip objects/functions
        if (typeof value !== 'object' && typeof value !== 'function') {
          element.setAttribute(
            attributeName,
            String(value as string | number | boolean)
          );
        }
      }
    },
    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) =>
      parent.insertBefore(child, reference),

    /**
     * Lifecycle: onAttach
     *
     * For non-async fragments: adds fragment-start/end comment markers immediately.
     * These markers enable the hydration adapter to locate fragment boundaries.
     *
     * For async fragments: skips marker insertion entirely. Markers are inserted
     * by renderToStringAsync AFTER all resolves complete, using tree traversal
     * to find async fragments and derive parentElement from the DOM tree.
     * This ensures markers wrap the final resolved content, not the initial pending state.
     */
    onAttach: (ref) => {
      // Only handle non-async fragments - async fragments are handled by renderToStringAsync
      if (ref.status !== STATUS_FRAGMENT) return;
      if (isAsyncFragment(ref)) return;

      // For non-async fragments, insert markers immediately
      insertFragmentMarkers(ref as FragmentRef<HTMLElement>);
    },
  };

  const serialize: Serialize = (element) => {
    const el = element as { outerHTML: string };
    return el.outerHTML;
  };

  return { adapter, serialize };
}
