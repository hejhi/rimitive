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
export function renderToString(
  nodeRef: NodeRef<unknown>,
  wrapElement?: ElementWrapper,
  wrapFragment?: FragmentWrapper
): string {
  if (nodeRef.status === STATUS_COMMENT) {
    return `<!--${(nodeRef).data}-->`;
  }

  if (nodeRef.status === STATUS_ELEMENT) {
    return renderElementToString(nodeRef, wrapElement);
  }

  if (nodeRef.status === STATUS_FRAGMENT) {
    return renderFragmentToString(nodeRef, wrapElement, wrapFragment);
  }

  // Unknown type - return empty string
  return '';
}

/**
 * Render an element ref to HTML string
 */
function renderElementToString(
  elementRef: ElementRef<unknown>,
  wrapElement?: ElementWrapper
): string {
  const element = elementRef.element as { outerHTML?: string };

  if (typeof element.outerHTML === 'string') {
    const html = element.outerHTML;

    // Apply custom wrapper if provided
    if (wrapElement) {
      return wrapElement(html, elementRef);
    }

    return html;
  }

  throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 */
function renderFragmentToString(
  fragmentRef: FragmentRef<unknown>,
  wrapElement?: ElementWrapper,
  wrapFragment?: FragmentWrapper
): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current as NodeRef<unknown>, wrapElement, wrapFragment));

    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  const html = parts.join('');

  // Apply custom wrapper if provided
  if (wrapFragment) {
    return wrapFragment(html, fragmentRef);
  }

  return html;
}
