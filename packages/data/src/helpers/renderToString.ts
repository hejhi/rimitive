/**
 * Island-aware renderToString
 *
 * Wraps islands in container divs for client-side hydration.
 * Uses the generic renderToString from @lattice/view with island wrappers.
 */

import { renderToString as baseRenderToString } from '@lattice/view/helpers/renderToString';
import type { NodeRef, ElementRef, FragmentRef } from '@lattice/view/types';

/**
 * Wrap island elements in container divs with script tag markers
 *
 * Finds elements with data-island-id attribute (added during SSR) and wraps them
 * in container divs. Removes the attribute from the inner element and adds a
 * script tag marker for client-side hydration targeting.
 *
 * Uses a simple state machine to properly match opening and closing tags.
 *
 * @param html - HTML string to process
 * @returns HTML string with islands wrapped and marked with script tags
 */
function wrapIslands(html: string): string {
  // Find all island elements and their positions
  const islands: Array<{ start: number; end: number; id: string; tagName: string }> = [];

  // Pattern to match opening tags with data-island-id
  const openTagPattern = /<(\w+)([^>]*?)\s+data-island-id="([^"]+)"([^>]*)>/g;

  let match;
  while ((match = openTagPattern.exec(html)) !== null) {
    const tagName = match[1]!;
    const islandId = match[3]!;
    const openTagStart = match.index;
    const openTagEnd = match.index + match[0].length;

    // Self-closing tag
    if (match[0].endsWith('/>')) {
      islands.push({
        start: openTagStart,
        end: openTagEnd,
        id: islandId,
        tagName,
      });
      continue;
    }

    // Find matching closing tag
    const closeTag = `</${tagName}>`;
    let depth = 1;
    let searchPos = openTagEnd;

    while (depth > 0 && searchPos < html.length) {
      const nextOpen = html.indexOf(`<${tagName}`, searchPos);
      const nextClose = html.indexOf(closeTag, searchPos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Found nested opening tag of same type
        depth++;
        searchPos = nextOpen + tagName.length + 1;
      } else {
        // Found closing tag
        depth--;
        if (depth === 0) {
          islands.push({
            start: openTagStart,
            end: nextClose + closeTag.length,
            id: islandId,
            tagName,
          });
        }
        searchPos = nextClose + closeTag.length;
      }
    }
  }

  // Process islands in reverse order to maintain string positions
  islands.sort((a, b) => b.start - a.start);

  let result = html;
  for (const island of islands) {
    const elementHTML = result.substring(island.start, island.end);
    // Remove data-island-id attribute from the island element itself
    const cleanHTML = elementHTML.replace(/\s+data-island-id="[^"]+"/g, '');
    // Add script tag with island ID for hydration
    const scriptTag = `<script type="application/json" data-island="${island.id}"></script>`;
    const wrapped = `<div id="${island.id}">${cleanHTML}${scriptTag}</div>`;
    result = result.substring(0, island.start) + wrapped + result.substring(island.end);
  }

  return result;
}

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
 * // html = '<div data-island-id="counter-0"><button>Count: 5</button></div>'
 * ```
 */
export function renderToString(nodeRef: NodeRef<unknown>): string {
  // Element wrapper - wraps islands in container divs
  const wrapElement = (html: string, elementRef: ElementRef<unknown>) => {
    const islandId = (elementRef as ElementRef<unknown> & { __islandId?: string }).__islandId;
    if (islandId) {
      return `<div data-island-id="${islandId}">${html}</div>`;
    }
    return html;
  };

  // Fragment wrapper - wraps island fragments with boundary markers
  const wrapFragment = (html: string, fragmentRef: FragmentRef<unknown>) => {
    const islandId = (fragmentRef as FragmentRef<unknown> & { __islandId?: string }).__islandId;
    if (islandId) {
      return `<div data-island-id="${islandId}"><!--fragment-start-->${html}<!--fragment-end--></div>`;
    }
    return html;
  };

  const html = baseRenderToString(nodeRef, wrapElement, wrapFragment);

  // Process HTML to wrap islands that were nested in the DOM tree
  return wrapIslands(html);
}
