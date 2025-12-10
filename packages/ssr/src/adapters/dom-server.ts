/**
 * Server-side DOM adapter using linkedom
 *
 * Renders Lattice components to HTML strings for SSR.
 * Adds fragment markers for hydration support.
 *
 * For async fragments (load()), resolved data is embedded directly
 * in the fragment-start marker as base64-encoded JSON. This enables
 * position-based hydration without needing separate ID tracking.
 *
 * IMPORTANT: Async fragment markers are inserted by renderToStringAsync AFTER
 * all async resolves complete. This ensures markers wrap the final resolved
 * content, not the initial pending state.
 */

import { parseHTML } from 'linkedom';
import type { Adapter, FragmentRef, NodeRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import { isAsyncFragment, ASYNC_FRAGMENT } from '@lattice/view/load';

/** Symbol to mark fragments that need deferred marker insertion */
export const DEFERRED_MARKERS = Symbol.for('lattice.deferred-markers');

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

/** Type for deferred marker entries */
export interface DeferredMarkerEntry {
  fragment: FragmentRef<HTMLElement>;
  parentElement: HTMLElement;
}

/** Adapter with deferred marker support (internal type) */
export type DOMServerAdapter = Adapter<DOMAdapterConfig> & {
  [DEFERRED_MARKERS]: DeferredMarkerEntry[];
};

/**
 * Insert markers for a fragment (used for deferred async fragment markers)
 */
export function insertFragmentMarkers(
  fragment: FragmentRef<HTMLElement>,
  parentElement: HTMLElement
): void {
  if (!fragment.firstChild || !fragment.lastChild) return;

  const firstNode = getFirstDOMNode(fragment.firstChild);
  const lastNode = getLastDOMNode(fragment.lastChild);

  if (!firstNode || !lastNode) return;

  // Build marker content - embed data for async fragments
  let markerContent = 'fragment-start';
  if (isAsyncFragment(fragment)) {
    const meta = fragment[ASYNC_FRAGMENT];
    const data = meta.getData();
    if (data !== undefined) {
      const json = JSON.stringify(data);
      const base64 = Buffer.from(json, 'utf-8').toString('base64');
      markerContent = `fragment-start:${base64}`;
    }
  }

  // Get document from parent element
  const doc = parentElement.ownerDocument;

  // Insert fragment-start comment before first child
  const startComment = doc.createComment(markerContent);
  parentElement.insertBefore(startComment, firstNode);

  // Insert fragment-end comment after last child
  const endComment = doc.createComment('fragment-end');
  parentElement.insertBefore(endComment, lastNode.nextSibling);
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

  // Track async fragments for deferred marker insertion
  const deferredMarkers: Array<{
    fragment: FragmentRef<HTMLElement>;
    parentElement: HTMLElement;
  }> = [];

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
     *
     * For async fragments: DEFERS marker insertion until after all resolves complete.
     * This ensures markers wrap the final resolved content, not the initial pending state.
     *
     * For resolved async fragments, the data is embedded in the fragment-start marker
     * as base64-encoded JSON: <!--fragment-start:eyJkYXRhIjoiLi4uIn0=-->
     */
    onAttach: (ref, parentElement) => {
      // Only handle fragments
      if (ref.status !== STATUS_FRAGMENT) return;

      const frag = ref as FragmentRef<HTMLElement>;

      // Defer async fragments - their content may change after resolve()
      // renderToStringAsync will insert markers after all resolves complete
      if (isAsyncFragment(ref)) {
        deferredMarkers.push({
          fragment: frag,
          parentElement: parentElement as HTMLElement,
        });
        return;
      }

      // For non-async fragments, insert markers immediately
      insertFragmentMarkers(frag, parentElement as HTMLElement);
    },

    // Expose deferred markers for renderToStringAsync (not part of public Adapter type)
    [DEFERRED_MARKERS]: deferredMarkers,
  } as Adapter<DOMAdapterConfig>;
}
