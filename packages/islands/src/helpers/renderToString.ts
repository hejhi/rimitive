/**
 * Island-aware renderToString for SSR
 *
 * Renders a node tree to HTML string. Islands are automatically decorated during rendering:
 * - Element islands: script tags added via decorateElement
 * - Fragment islands: wrapped in divs with script tags via decorateFragment
 */

import type { NodeRef, ElementRef, FragmentRef } from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';

/**
 * Render a node tree to HTML string
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @returns HTML string with island markers already in place
 */
export function renderToString(
  nodeRef: NodeRef<unknown>
): string {
  if (nodeRef.status === STATUS_ELEMENT) return renderElementToString(nodeRef);
  if (nodeRef.status === STATUS_FRAGMENT) return renderFragmentToString(nodeRef);

  // Unknown type - return empty string
  return '';
}

/**
 * Render an element ref to HTML string
 *
 * With fragments now decorated in the DOM (via decorateFragment), we can simply
 * use outerHTML - fragment boundaries are already marked with HTML comments.
 */
function renderElementToString(
  elementRef: ElementRef<unknown>
): string {
  const element = elementRef.element as { outerHTML?: string };

  if (typeof element.outerHTML !== 'string') {
    throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
  }

  return element.outerHTML;
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 *
 * Fragments don't have a DOM element, so we walk their children and concatenate.
 * Fragment boundaries are already marked in the DOM with comments (via decorateFragment).
 */
function renderFragmentToString(
  fragmentRef: FragmentRef<unknown>
): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current));

    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  return parts.join('');
}
