/**
 * Server-side DOM adapter using linkedom
 *
 * Renders Lattice components to HTML strings for SSR.
 * Adds fragment markers for hydration support.
 */

import { parseHTML } from 'linkedom';
import type { Adapter, FragmentRef, NodeRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';

/**
 * Get the first DOM node from a NodeRef (iteratively traversing nested fragments)
 */
function getFirstDOMNode(nodeRef: NodeRef<unknown>): Node | null {
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
 * Create a linkedom adapter for server-side rendering
 *
 * Renders components to HTML with fragment markers for hydration.
 *
 * @example
 * ```typescript
 * import { createDOMServerAdapter } from '@lattice/ssr/adapters/dom-server';
 * import { createView } from '@lattice/view/presets/core';
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const signals = createSignals();
 * const adapter = createDOMServerAdapter();
 * const view = createView({ adapter, signals })();
 *
 * const app = view.el('div')(view.el('h1')('Hello SSR'));
 * ```
 */
export function createDOMServerAdapter(): Adapter<DOMAdapterConfig> {
  // Create a document context for element creation
  const { document } = parseHTML('<!DOCTYPE html><html></html>');

  return {
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
     * For fragments: adds fragment-start/end comment markers.
     * These markers enable the hydration adapter to locate fragment boundaries.
     */
    onAttach: (ref, parentElement) => {
      // Only handle fragments
      if (ref.status !== STATUS_FRAGMENT) return;

      const frag = ref as FragmentRef<HTMLElement>;

      // Skip if fragment has no children
      if (!frag.firstChild || !frag.lastChild) return;

      // Find first and last actual DOM nodes
      const firstNode = getFirstDOMNode(frag.firstChild);
      const lastNode = getLastDOMNode(frag.lastChild);

      if (!firstNode || !lastNode) return;

      // Insert fragment-start comment before first child
      const startComment = document.createComment('fragment-start');
      parentElement.insertBefore(startComment, firstNode);

      // Insert fragment-end comment after last child
      const endComment = document.createComment('fragment-end');
      parentElement.insertBefore(endComment, lastNode.nextSibling);
    },
  };
}
