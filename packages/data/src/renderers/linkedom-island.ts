/**
 * Island-aware linkedom renderer for SSR
 *
 * Standalone linkedom renderer with island support and fragment decoration
 */

import { parseHTML } from 'linkedom';
import type { Renderer, RendererConfig } from '@lattice/view/types';
import type { FragmentRef, NodeRef } from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';

export interface LinkedomRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
  comment: Comment;
}

/**
 * Get the first DOM node from a NodeRef (recursively traversing fragments)
 */
function getFirstDOMNode(nodeRef: NodeRef<unknown>): Node | null {
  if (nodeRef.status === STATUS_ELEMENT) {
    return nodeRef.element as Node;
  }
  if (nodeRef.status === STATUS_FRAGMENT) {
    if (nodeRef.firstChild) {
      return getFirstDOMNode(nodeRef.firstChild);
    }
  }
  return null;
}

/**
 * Get the last DOM node from a NodeRef (recursively traversing fragments)
 */
function getLastDOMNode(nodeRef: NodeRef<unknown>): Node | null {
  if (nodeRef.status === STATUS_ELEMENT) {
    return nodeRef.element as Node;
  }
  if (nodeRef.status === STATUS_FRAGMENT) {
    if (nodeRef.lastChild) {
      return getLastDOMNode(nodeRef.lastChild);
    }
  }
  return null;
}

/**
 * Create an island-aware linkedom renderer that decorates island fragments
 * with script tags for hydration
 */
export function createLinkedomIslandRenderer(): Renderer<LinkedomRendererConfig> {
  // Create a document context for element creation
  const { document } = parseHTML('<!DOCTYPE html><html></html>');

  return {
    createElement: (tag) => document.createElement(tag),
    createTextNode: (text) => document.createTextNode(text),
    createComment: (data) => document.createComment(data),
    updateTextNode: (node, text) => (node.textContent = text),
    setAttribute: (element, key, value) => {
      // Skip event handlers during SSR (no interactivity on server)
      if (key.startsWith('on')) return;

      // Map JSX-style props to HTML attributes
      const attributeName = key === 'className' ? 'class' : key;

      // Use setAttribute for proper HTML attribute handling
      // linkedom automatically handles escaping and attribute normalization
      if (value != null && value !== false) {
        // Only stringify primitives, skip objects/functions
        if (typeof value !== 'object' && typeof value !== 'function') {
          element.setAttribute(attributeName, String(value as string | number | boolean));
        }
      }
    },
    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) =>
      parent.insertBefore(child, reference),
    // In linkedom, elements are always "connected" to the document
    isConnected: (element) => element.isConnected,
    // No-op for SSR - events aren't meaningful on the server
    // Return empty cleanup function
    addEventListener: () => () => () => {},
    serializeElement: (element, childrenHTML) => {
      // Create a clone with the same tag and attributes
      const clone = document.createElement(element.tagName);
      // Copy all attributes
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (attr) clone.setAttribute(attr.name, attr.value);
      }
      // Set the custom children HTML
      clone.innerHTML = childrenHTML;
      // Return serialized HTML
      return clone.outerHTML;
    },

    /**
     * Decorate elements with island script tags
     *
     * For island elements (those with __islandId):
     * Inserts <script data-island="..."></script> after the element
     */
    decorateElement: (elementRef: unknown, element: HTMLElement) => {
      const islandId = (elementRef as { __islandId?: string }).__islandId;

      if (islandId) {
        const parent = element.parentNode;
        if (!parent) return;

        // Create script tag
        const script = element.ownerDocument.createElement('script');
        script.setAttribute('type', 'application/json');
        script.setAttribute('data-island', islandId);

        // Insert after element
        parent.insertBefore(script, element.nextSibling);
      }
    },

    /**
     * Decorate fragments with island markers and wrapper div
     *
     * For island fragments (those with __islandId):
     * 1. Inserts fragment-start/end comments
     * 2. Wraps the fragment and comments in a container div
     * 3. Adds script tag marker inside the wrapper div
     *
     * Structure: <div><!--fragment-start-->...children...<!--fragment-end--><script data-island="..."></script></div>
     *
     * For non-island fragments:
     * Just adds fragment-start/end comments without wrapper
     */
    decorateFragment: (fragmentRef: unknown, parentElement: HTMLElement) => {
      // Check if this is an island fragment
      const islandId = (fragmentRef as FragmentRef<unknown> & { __islandId?: string }).__islandId;

      if (islandId) {
        const parent = parentElement;
        const frag = fragmentRef as FragmentRef<unknown>;

        // Skip if fragment has no children
        if (!frag.firstChild || !frag.lastChild) return;

        // Find first and last actual DOM nodes
        const firstNode = getFirstDOMNode(frag.firstChild);
        const lastNode = getLastDOMNode(frag.lastChild);

        if (!firstNode || !lastNode) return;

        // Create wrapper div
        const wrapper = parent.ownerDocument.createElement('div');

        // Create comment markers
        const startComment = parent.ownerDocument.createComment('fragment-start');
        const endComment = parent.ownerDocument.createComment('fragment-end');

        // Create script tag
        const scriptTag = parent.ownerDocument.createElement('script');
        scriptTag.setAttribute('type', 'application/json');
        scriptTag.setAttribute('data-island', islandId);

        // Insert wrapper before first node
        parent.insertBefore(wrapper, firstNode);

        // Build wrapper content: comment, nodes, comment, script
        wrapper.appendChild(startComment);

        // Move all fragment nodes into wrapper
        let current: Node | null = firstNode;
        while (current) {
          const next: Node | null = current.nextSibling;
          wrapper.appendChild(current);
          if (current === lastNode) break;
          current = next;
        }

        wrapper.appendChild(endComment);
        wrapper.appendChild(scriptTag);
      } else {
        // Non-island fragment - just add comment markers (no wrapper)
        const fragment = fragmentRef as FragmentRef<unknown>;

        // Skip if fragment has no children
        if (!fragment.firstChild || !fragment.lastChild) return;

        // Find first and last actual DOM nodes
        const firstNode = getFirstDOMNode(fragment.firstChild);
        const lastNode = getLastDOMNode(fragment.lastChild);

        if (!firstNode || !lastNode) return;

        // Insert fragment-start comment before first child
        const startComment = document.createComment('fragment-start');
        parentElement.insertBefore(startComment, firstNode);

        // Insert fragment-end comment after last child
        const endComment = document.createComment('fragment-end');
        parentElement.insertBefore(endComment, lastNode.nextSibling);
      }
    },
  };
}
