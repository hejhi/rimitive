/**
 * Synchronous HTML serialization for SSR.
 *
 * Renders a NodeRef tree to an HTML string by walking the
 * element / fragment structure and delegating to the adapter's
 * serialize function.
 */

import type { NodeRef, FragmentRef } from '@rimitive/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';

/**
 * Render a node tree to HTML string
 *
 * @param nodeRef - The node tree to render
 * @param serialize - Function to serialize elements to HTML (from createParse5Adapter)
 */
export function renderToString(
  nodeRef: NodeRef<unknown>,
  serialize: Serialize
): string {
  const { status } = nodeRef;
  if (status === STATUS_ELEMENT) return serialize(nodeRef.element);
  if (status === STATUS_FRAGMENT)
    return renderFragmentToString(nodeRef, serialize);
  return '';
}

function renderFragmentToString(
  fragmentRef: FragmentRef<unknown>,
  serialize: Serialize
): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current, serialize));
    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  return parts.join('');
}
