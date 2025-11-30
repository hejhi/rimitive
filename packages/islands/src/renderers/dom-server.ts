/**
 * Island-aware linkedom renderer for SSR
 *
 * Standalone linkedom renderer with island support and fragment decoration
 */

import { parseHTML } from 'linkedom';
import type { Renderer, FragmentRef, NodeRef } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import type { IslandNodeMeta } from '../types';
import { registerIsland } from '../ssr-context';

// Re-export DOMRendererConfig as DOMServerRendererConfig for backwards compatibility
export type { DOMRendererConfig as DOMServerRendererConfig } from '@lattice/view/renderers/dom';

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
 * Create an island-aware linkedom renderer that decorates island fragments
 * with script tags for hydration
 */
export function createDOMServerRenderer(): Renderer<DOMRendererConfig> {
  // Create a document context for element creation
  const { document } = parseHTML('<!DOCTYPE html><html></html>');

  return {
    createElement: (tag) => document.createElement(tag),
    createTextNode: (text) => document.createTextNode(text),
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
    // In linkedom, elements are always "connected" to the document
    isConnected: (element) => element.isConnected,
    // No-op for SSR - events aren't meaningful on the server
    // Return empty cleanup function
    addEventListener: () => () => () => {},

    /**
     * Decorate elements with island script tags (atomic registration)
     *
     * For island elements (those with __islandMeta):
     * 1. Registers the island in SSR context (generates hydration script)
     * 2. Inserts <script data-island="..."></script> after the element
     *
     * This ensures registration and decoration happen atomically - only
     * actually-rendered islands get registered for hydration.
     */
    decorateElement: (elementRef: unknown, element: HTMLElement) => {
      const meta = (elementRef as { __islandMeta?: IslandNodeMeta })
        .__islandMeta;

      if (meta) {
        const parent = element.parentNode;
        if (!parent) return;

        // Register NOW - atomic with decoration, only for rendered islands
        const instanceId = registerIsland(
          meta.type,
          meta.props,
          STATUS_ELEMENT
        );

        // Store instance ID back on ref for downstream use
        (elementRef as { __islandId?: string }).__islandId = instanceId;

        // Create script tag
        const script = element.ownerDocument.createElement('script');
        script.setAttribute('type', 'application/json');
        script.setAttribute('data-island', instanceId);

        // Insert after element
        parent.insertBefore(script, element.nextSibling);
      }
    },

    /**
     * Decorate fragments with island markers and wrapper div (atomic registration)
     *
     * For island fragments (those with __islandMeta):
     * 1. Registers the island in SSR context (generates hydration script)
     * 2. Inserts fragment-start/end comments
     * 3. Wraps the fragment and comments in a container div
     * 4. Adds script tag marker inside the wrapper div
     *
     * Structure: <div><!--fragment-start-->...children...<!--fragment-end--><script data-island="..."></script></div>
     *
     * For non-island fragments:
     * Just adds fragment-start/end comments without wrapper
     *
     * This ensures registration and decoration happen atomically - only
     * actually-rendered islands get registered for hydration.
     */
    decorateFragment: (fragmentRef: unknown, parentElement: HTMLElement) => {
      // Check if this is an island fragment (lazy registration)
      const meta = (
        fragmentRef as FragmentRef<unknown> & { __islandMeta?: IslandNodeMeta }
      ).__islandMeta;

      if (meta) {
        const parent = parentElement;
        const frag = fragmentRef as FragmentRef<unknown>;

        // Skip if fragment has no children
        if (!frag.firstChild || !frag.lastChild) return;

        // Find first and last actual DOM nodes
        const firstNode = getFirstDOMNode(frag.firstChild);
        const lastNode = getLastDOMNode(frag.lastChild);

        if (!firstNode || !lastNode) return;

        // Register NOW - atomic with decoration, only for rendered islands
        const instanceId = registerIsland(
          meta.type,
          meta.props,
          STATUS_FRAGMENT
        );

        // Store instance ID back on ref for downstream use
        (
          fragmentRef as FragmentRef<unknown> & { __islandId?: string }
        ).__islandId = instanceId;

        // Create wrapper div
        const wrapper = parent.ownerDocument.createElement('div');

        // Create comment markers
        const startComment =
          parent.ownerDocument.createComment('fragment-start');
        const endComment = parent.ownerDocument.createComment('fragment-end');

        // Create script tag
        const scriptTag = parent.ownerDocument.createElement('script');
        scriptTag.setAttribute('type', 'application/json');
        scriptTag.setAttribute('data-island', instanceId);

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
        return;
      }

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
    },
  };
}
