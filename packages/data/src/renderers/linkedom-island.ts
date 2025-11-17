/**
 * Island-aware linkedom renderer for SSR
 *
 * Extends the base linkedom renderer to decorate island fragments with script tags
 */

import {
  createLinkedomRenderer,
} from '@lattice/view/renderers/linkedom';
import type { FragmentRef } from '@lattice/view/types';

/**
 * Create an island-aware linkedom renderer that decorates island fragments
 * with script tags for hydration
 */
export function createLinkedomIslandRenderer(): ReturnType<typeof createLinkedomRenderer> {
  const baseRenderer = createLinkedomRenderer();

  return {
    ...baseRenderer,

    /**
     * Decorate elements with island script tags
     *
     * For island elements (those with __islandId):
     * Inserts <script data-island="..."></script> after the element
     */
    decorateElement: (elementRef: unknown, element: HTMLElement) => {
      const islandId = (elementRef as { __islandId?: string }).__islandId;

      if (islandId) {
        const parent = element.parentNode;
        if (!parent) return;

        // Create script tag
        const script = element.ownerDocument.createElement('script');
        script.setAttribute('type', 'application/json');
        script.setAttribute('data-island', islandId);

        // Insert after element
        parent.insertBefore(script, element.nextSibling);
      }
    },

    /**
     * Decorate fragments with island markers and wrapper div
     *
     * For island fragments (those with __islandId):
     * 1. Inserts fragment-start/end comments (via base renderer)
     * 2. Wraps the fragment and comments in a container div
     * 3. Adds script tag marker inside the wrapper div
     *
     * Structure: <div><!--fragment-start-->...children...<!--fragment-end--><script data-island="..."></script></div>
     */
    decorateFragment: (fragmentRef: unknown, parentElement: HTMLElement) => {
      // Check if this is an island fragment BEFORE decoration
      const islandId = (fragmentRef as FragmentRef<unknown> & { __islandId?: string }).__islandId;

      if (islandId) {
        const parent = parentElement;
        const frag = fragmentRef as FragmentRef<unknown>;

        // Get first and last DOM nodes of the fragment
        const getFirstNode = (ref: typeof frag.firstChild): Node | null => {
          if (!ref) return null;
          if ('element' in ref && ref.element) return ref.element as Node;
          if ('firstChild' in ref && ref.firstChild) return getFirstNode(ref.firstChild);
          return null;
        };

        const getLastNode = (ref: typeof frag.lastChild): Node | null => {
          if (!ref) return null;
          if ('element' in ref && ref.element) return ref.element as Node;
          if ('lastChild' in ref && ref.lastChild) return getLastNode(ref.lastChild);
          return null;
        };

        const firstNode = getFirstNode(frag.firstChild);
        const lastNode = getLastNode(frag.lastChild);

        if (!firstNode || !lastNode) return;

        // Create wrapper div
        const wrapper = parent.ownerDocument.createElement('div');

        // Create comment markers
        const startComment = parent.ownerDocument.createComment('fragment-start');
        const endComment = parent.ownerDocument.createComment('fragment-end');

        // Create script tag
        const scriptTag = parent.ownerDocument.createElement('script');
        scriptTag.setAttribute('type', 'application/json');
        scriptTag.setAttribute('data-island', islandId);

        // Insert wrapper before first node
        parent.insertBefore(wrapper, firstNode);

        // Build wrapper content: comment, nodes, comment, script
        wrapper.appendChild(startComment);

        // Move all fragment nodes into wrapper
        let current: Node | null = firstNode;
        while (current) {
          const next: Node | null = current.nextSibling;
          wrapper.appendChild(current);
          if (current === lastNode) break;
          current = next;
        }

        wrapper.appendChild(endComment);
        wrapper.appendChild(scriptTag);
      } else {
        // Non-island fragment - just add comment markers (no wrapper)
        baseRenderer.decorateFragment?.(fragmentRef, parentElement);
      }
    }
  };
}
