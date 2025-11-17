/**
 * Island-aware renderToString
 *
 * Wraps islands in container divs for client-side hydration.
 * Uses the generic renderToString from @lattice/view with island wrappers.
 */

import { renderToString as baseRenderToString } from '@lattice/view/helpers/renderToString';
import type { NodeRef } from '@lattice/view/types';


/**
 * Render a node tree to HTML string
 *
 * Islands are automatically decorated during rendering:
 * - Element islands: script tags added via decorateElement
 * - Fragment islands: wrapped in divs with script tags via decorateFragment
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @returns HTML string with island markers already in place
 */
export function renderToString(
  nodeRef: NodeRef<unknown>
): string {
  // Islands are already decorated by the linkedom-island renderer during rendering
  // No post-processing needed!
  return baseRenderToString(nodeRef);
}
