/**
 * Linkedom Renderer - Node.js SSR implementation
 */

import { parseHTML } from 'linkedom';
import type { Renderer, RendererConfig } from '../renderer';

export interface LinkedomRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
  comment: Comment;
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
  };
}
