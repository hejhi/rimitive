/**
 * Island-aware renderToString
 *
 * Wraps islands in container divs for client-side hydration.
 * Uses the generic renderToString from @lattice/view with island wrappers.
 */

import { renderToString as baseRenderToString } from '@lattice/view/helpers/renderToString';
import type { NodeRef, FragmentRef } from '@lattice/view/types';


/**
 * Render a node tree to HTML string with island wrapping
 *
 * Islands (marked with __islandId) are wrapped in container divs with script tag markers
 * for client-side hydration targeting.
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @returns HTML string with islands wrapped
 */
/**
 * Process HTML to add script tag markers after island elements
 * Removes data-island-id attributes and adds script tags as siblings
 */
function addIslandScriptTags(html: string): string {
  const islands: Array<{ start: number; end: number; id: string }> = [];

  // Find all elements with data-island-id
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
        depth++;
        searchPos = nextOpen + tagName.length + 1;
      } else {
        depth--;
        if (depth === 0) {
          islands.push({
            start: openTagStart,
            end: nextClose + closeTag.length,
            id: islandId,
          });
        }
        searchPos = nextClose + closeTag.length;
      }
    }
  }

  // Process islands in reverse order to maintain positions
  islands.sort((a, b) => b.start - a.start);

  let result = html;
  for (const island of islands) {
    const elementHTML = result.substring(island.start, island.end);
    const cleanHTML = elementHTML.replace(/\s+data-island-id="[^"]+"/g, '');
    const scriptTag = `<script type="application/json" data-island="${island.id}"></script>`;
    result = result.substring(0, island.start) + cleanHTML + scriptTag + result.substring(island.end);
  }

  return result;
}

export function renderToString<TElement = unknown>(
  nodeRef: NodeRef<unknown>,
  renderer: { serializeElement: (element: TElement, childrenHTML: string) => string }
): string {
  // Fragment wrapper - wraps island fragments with boundary markers and script tag in container div
  const wrapFragment = (html: string, fragmentRef: FragmentRef<unknown>) => {
    const islandId = (fragmentRef as FragmentRef<unknown> & { __islandId?: string }).__islandId;
    if (islandId) {
      const scriptTag = `<script type="application/json" data-island="${islandId}"></script>`;
      return `<div><!--fragment-start-->${html}<!--fragment-end-->${scriptTag}</div>`;
    }
    return html;
  };

  const html = baseRenderToString(nodeRef, { renderer, wrapFragment });
  return addIslandScriptTags(html);
}
