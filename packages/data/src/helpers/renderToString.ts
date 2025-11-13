/**
 * Island-aware renderToString
 *
 * Wraps islands in container divs for client-side hydration.
 * Uses the generic renderToString from @lattice/view with island wrappers.
 */

import { renderToString as baseRenderToString } from '@lattice/view/helpers/renderToString';
import type { NodeRef, ElementRef, FragmentRef } from '@lattice/view/types';

/**
 * Render a node tree to HTML string with island wrapping
 *
 * Islands (marked with __islandId) are wrapped in container divs
 * for client-side hydration targeting.
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @returns HTML string with islands wrapped
 *
 * @example
 * ```ts
 * import { island, createSSRContext, runWithSSRContext } from '@lattice/data';
 * import { renderToString } from '@lattice/data/helpers/renderToString';
 * import { createSSRApi } from '@lattice/view/presets/ssr';
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 *
 * const Counter = island('counter', create(({ el, signal }) => (props) => {
 *   const count = signal(props.initialCount);
 *   return el('button', { onClick: () => count(count() + 1) })(
 *     `Count: ${count()}`
 *   )();
 * }));
 *
 * const signals = createSignalsApi();
 * const { mount } = createSSRApi(signals);
 *
 * const ctx = createSSRContext();
 * const html = runWithSSRContext(ctx, () =>
 *   renderToString(mount(Counter({ initialCount: 5 })))
 * );
 * // html = '<div id="counter-0"><button>Count: 5</button></div>'
 * ```
 */
export function renderToString(nodeRef: NodeRef<unknown>): string {
  // Element wrapper - wraps islands in container divs
  const wrapElement = (html: string, elementRef: ElementRef<unknown>) => {
    const islandId = (elementRef as ElementRef<unknown> & { __islandId?: string }).__islandId;
    if (islandId) {
      return `<div id="${islandId}">${html}</div>`;
    }
    return html;
  };

  // Fragment wrapper - wraps island fragments with boundary markers
  const wrapFragment = (html: string, fragmentRef: FragmentRef<unknown>) => {
    const islandId = (fragmentRef as FragmentRef<unknown> & { __islandId?: string }).__islandId;
    if (islandId) {
      return `<div id="${islandId}"><!--fragment-start-->${html}<!--fragment-end--></div>`;
    }
    return html;
  };

  return baseRenderToString(nodeRef, wrapElement, wrapFragment);
}
