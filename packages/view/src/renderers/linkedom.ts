/**
 * Linkedom Renderer - Node.js SSR implementation
 */

import { parseHTML } from 'linkedom';
import type { Renderer, RendererConfig } from '../renderer';
import type { FragmentRef, NodeRef } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_COMMENT } from '../types';

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
  if (nodeRef.status === STATUS_COMMENT) {
    return (nodeRef as { data: string; element?: Node }).element ?? null;
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
  if (nodeRef.status === STATUS_COMMENT) {
    return (nodeRef as { data: string; element?: Node }).element ?? null;
  }
  if (nodeRef.status === STATUS_FRAGMENT) {
    if (nodeRef.lastChild) {
      return getLastDOMNode(nodeRef.lastChild);
    }
  }
  return null;
}

/**
 * Create a linkedom renderer for server-side rendering
 */
export function createLinkedomRenderer(): Renderer<LinkedomRendererConfig> {
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

    decorateFragment: (fragmentRef, parentElement) => {
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
    },
  };
}
