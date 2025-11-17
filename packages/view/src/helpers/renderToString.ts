/**
 * Server-side rendering utilities for extracting HTML from linkedom elements
 */

import type { NodeRef, ElementRef, FragmentRef } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_COMMENT } from '../types';

/**
 * Element wrapper function type
 * Allows customizing how elements are wrapped in the output HTML
 */
export type ElementWrapper = (html: string, elementRef: ElementRef<unknown>) => string;

/**
 * Fragment wrapper function type
 * Allows customizing how fragments are wrapped in the output HTML
 */
export type FragmentWrapper = (html: string, fragmentRef: FragmentRef<unknown>) => string;

/**
 * Extract HTML string from a rendered element or fragment
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @param wrapElement - Optional function to wrap element HTML (e.g., for islands)
 * @param wrapFragment - Optional function to wrap fragment HTML (e.g., for islands)
 * @param renderer - Optional renderer for serialization (uses serializeElement method)
 * @returns HTML string representation
 *
 * @example
 * ```ts
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createSSRApi } from '@lattice/view/presets/ssr';
 * import { renderToString } from '@lattice/view/helpers/renderToString';
 *
 * const signals = createSignalsApi();
 * const { api, mount, create } = createSSRApi(signals);
 *
 * const App = create(({ el }) => () => {
 *   return el('div', { className: 'app' })(
 *     el('h1')('Hello SSR!')
 *   )();
 * });
 *
 * const rendered = mount(App());
 * const html = renderToString(rendered);
 * // html = '<div class="app"><h1>Hello SSR!</h1></div>'
 * ```
 */
export function renderToString<TElement = unknown>(
  nodeRef: NodeRef<unknown>,
  wrapElement?: ElementWrapper,
  wrapFragment?: FragmentWrapper,
  renderer?: { serializeElement: (element: TElement, childrenHTML: string) => string }
): string {
  if (nodeRef.status === STATUS_COMMENT) {
    return `<!--${(nodeRef).data}-->`;
  }

  if (nodeRef.status === STATUS_ELEMENT) {
    return renderElementToString(nodeRef, wrapElement, wrapFragment, renderer);
  }

  if (nodeRef.status === STATUS_FRAGMENT) {
    return renderFragmentToString(nodeRef, wrapElement, wrapFragment, renderer);
  }

  // Unknown type - return empty string
  return '';
}

/**
 * Check if element or any descendant has fragment children (recursive check)
 */
function hasFragmentDescendants(elementRef: ElementRef<unknown>): boolean {
  if (!elementRef.firstChild) return false;

  let current: typeof elementRef.firstChild | null = elementRef.firstChild;

  while (current) {
    // Direct fragment child found
    if (current.status === STATUS_FRAGMENT) return true;

    // Check descendants recursively for elements
    if (current.status === STATUS_ELEMENT && hasFragmentDescendants(current)) {
      return true;
    }

    if (current === elementRef.lastChild) break;
    current = current.next;
  }

  return false;
}

/**
 * Render an element ref to HTML string
 *
 * Only walks the NodeRef tree if there are fragment descendants.
 * Otherwise uses outerHTML to preserve all DOM content including text nodes.
 */
function renderElementToString<TElement = unknown>(
  elementRef: ElementRef<unknown>,
  wrapElement?: ElementWrapper,
  wrapFragment?: FragmentWrapper,
  renderer?: { serializeElement: (element: TElement, childrenHTML: string) => string }
): string {
  const element = elementRef.element as { outerHTML?: string };

  if (typeof element.outerHTML !== 'string') {
    throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
  }

  // If no fragment descendants anywhere, use outerHTML (fastest, preserves all DOM content)
  if (!hasFragmentDescendants(elementRef)) {
    const html = element.outerHTML;
    return wrapElement ? wrapElement(html, elementRef) : html;
  }

  // Has fragment descendants - need to walk tree to wrap them properly
  const childParts: string[] = [];
  let current: typeof elementRef.firstChild | null = elementRef.firstChild;

  while (current) {
    if (current.status === STATUS_FRAGMENT) {
      childParts.push(renderFragmentToString(current, wrapElement, wrapFragment, renderer));
    } else {
      childParts.push(renderToString(current, wrapElement, wrapFragment, renderer));
    }

    if (current === elementRef.lastChild) break;
    current = current.next as typeof elementRef.firstChild | null;
  }

  // Use renderer to serialize element with walked children
  if (!renderer) {
    throw new Error('Renderer required for elements with fragment descendants');
  }

  const html = renderer.serializeElement(element as TElement, childParts.join(''));
  return wrapElement ? wrapElement(html, elementRef) : html;
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 */
function renderFragmentToString<TElement = unknown>(
  fragmentRef: FragmentRef<unknown>,
  wrapElement?: ElementWrapper,
  wrapFragment?: FragmentWrapper,
  renderer?: { serializeElement: (element: TElement, childrenHTML: string) => string }
): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(
      renderToString(
        current,
        wrapElement,
        wrapFragment,
        renderer
      )
    );

    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  const stringified = parts.join('');

  // Apply custom wrapper if provided
  if (wrapFragment) return wrapFragment(stringified, fragmentRef);

  return stringified;
}
