/**
 * Linkedom Renderer - Node.js SSR implementation
 *
 * Uses linkedom for a full DOM API in Node.js. This renderer is nearly identical
 * to the DOM renderer, but works server-side. It provides automatic HTML escaping,
 * proper void element handling, and full DOM compatibility.
 *
 * Usage:
 *   const renderer = createLinkedomRenderer();
 *   const root = el(['div', el(['h1', 'Hello'])]);
 *   const html = root.create().element.outerHTML;
 */

import { parseHTML } from 'linkedom';
import type { Renderer, RendererConfig } from '../renderer';

/**
 * LinkedOM Renderer configuration - maps to HTML elements (similar to DOM)
 * Note: linkedom provides DOM-like elements but events aren't meaningful in SSR
 */
export interface LinkedomRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
}

/**
 * Create a linkedom renderer for server-side rendering
 *
 * @returns A renderer instance that generates HTML in Node.js
 *
 * @example
 * ```ts
 * const renderer = createLinkedomRenderer();
 * const { el } = createElFactory({ ctx, effect, renderer });
 *
 * const app = el(['div',
 *   el(['h1', 'Hello World']),
 *   el(['p', 'Server-side rendered!'])
 * ]);
 *
 * const html = app.create().element.outerHTML;
 * // <div><h1>Hello World</h1><p>Server-side rendered!</p></div>
 * ```
 */
export function createLinkedomRenderer(): Renderer<LinkedomRendererConfig> {
  // Create a document context for element creation
  const { document } = parseHTML('<!DOCTYPE html><html></html>');

  return {
    createElement: (tag) => {
      return document.createElement(tag);
    },

    createTextNode: (text) => {
      return document.createTextNode(text);
    },

    updateTextNode: (node, text) => {
      node.textContent = text;
    },

    setAttribute: (element, key, value) => {
      // Skip event handlers during SSR (no interactivity on server)
      if (key.startsWith('on')) return;

      // Use setAttribute for proper HTML attribute handling
      // linkedom automatically handles escaping and attribute normalization
      if (value != null && value !== false) {
        // Only stringify primitives, skip objects/functions
        if (typeof value !== 'object' && typeof value !== 'function') {
          element.setAttribute(key, String(value as string | number | boolean));
        }
      }
    },

    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) =>
      parent.insertBefore(child, reference),
    // In linkedom, elements are always "connected" to the document
    isConnected: (element) => element.isConnected,

    addEventListener: () => () => {
      // No-op for SSR - events aren't meaningful on the server
      // Return empty cleanup function
      return () => {};
    },
  };
}
