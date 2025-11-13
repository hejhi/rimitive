/**
 * Server-side rendering utilities for extracting HTML from linkedom elements
 */

import type { NodeRef, ElementRef, FragmentRef } from '../types';
import { STATUS_ELEMENT } from '../types';

/**
 * Extract HTML string from a rendered element or fragment
 *
 * @param nodeRef - The rendered node reference from mount() or create()
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
export function renderToString(nodeRef: NodeRef<unknown>): string {
  if (nodeRef.status === STATUS_ELEMENT) {
    return renderElementToString(nodeRef);
  }

  // TypeScript knows this must be STATUS_FRAGMENT since NodeRef is a union
  // of ElementRef and FragmentRef only
  return renderFragmentToString(nodeRef);
}

/**
 * Render an element ref to HTML string
 */
function renderElementToString(elementRef: ElementRef<unknown>): string {
  const element = elementRef.element as unknown as { outerHTML?: string };

  if (typeof element.outerHTML === 'string') {
    return element.outerHTML;
  }

  throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 */
function renderFragmentToString(fragmentRef: FragmentRef<unknown>): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    // firstChild and next are BaseRef, but at runtime they're always NodeRef
    // Safe to cast since fragments only contain element/fragment children
    parts.push(renderToString(current as NodeRef<unknown>));
    current = current.next;
  }

  return parts.join('');
}
