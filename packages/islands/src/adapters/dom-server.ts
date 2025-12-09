/**
 * Island-aware SSR adapter
 *
 * Wraps the base SSR adapter from @lattice/ssr and adds island-specific behavior:
 * - Element islands: adds script tag marker after element
 * - Fragment islands: wraps in div with script tag marker
 */

import type { Adapter, FragmentRef, ElementRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import { createDOMServerAdapter as createBaseAdapter } from '@lattice/ssr/server';
import type { IslandNodeMeta } from '../types';
import { registerIsland } from '../ssr-context';

/**
 * Get the first DOM node from a NodeRef (iteratively traversing nested fragments)
 */
function getFirstDOMNode(
  nodeRef: ElementRef<unknown> | FragmentRef<unknown>
): Node | null {
  let current: ElementRef<unknown> | FragmentRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current.element as Node;
    }
    if (current.status === STATUS_FRAGMENT) {
      current = current.firstChild;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Get the last DOM node from a NodeRef (iteratively traversing nested fragments)
 */
function getLastDOMNode(
  nodeRef: ElementRef<unknown> | FragmentRef<unknown>
): Node | null {
  let current: ElementRef<unknown> | FragmentRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current.element as Node;
    }
    if (current.status === STATUS_FRAGMENT) {
      current = current.lastChild;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Create an island-aware SSR adapter
 *
 * Extends the base SSR adapter with island registration and script tag injection.
 *
 * @example
 * ```typescript
 * import { createDOMServerAdapter } from '@lattice/islands/server';
 *
 * const adapter = createDOMServerAdapter();
 * // Use with createView(), components with island() will be registered
 * ```
 */
export function createDOMServerAdapter(): Adapter<DOMAdapterConfig> {
  const base = createBaseAdapter();

  return {
    // Delegate base operations to ssr adapter
    createNode: base.createNode,
    setProperty: base.setProperty,
    appendChild: base.appendChild,
    removeChild: base.removeChild,
    insertBefore: base.insertBefore,

    /**
     * Lifecycle: onCreate
     *
     * For island elements (those with __islandMeta):
     * 1. Registers the island in SSR context
     * 2. Inserts <script data-island="..."></script> after the element
     */
    onCreate: (ref, parentElement) => {
      if (ref.status !== STATUS_ELEMENT) return;

      const element = ref.element as Node;
      const meta = (ref as ElementRef<Node> & { __islandMeta?: IslandNodeMeta })
        .__islandMeta;

      if (meta) {
        if (!parentElement) return;

        // Register island atomically with decoration
        const instanceId = registerIsland(
          meta.type,
          meta.props,
          STATUS_ELEMENT
        );

        // Store instance ID on ref
        (ref as ElementRef<Node> & { __islandId?: string }).__islandId =
          instanceId;

        // Create and insert script tag marker
        const script = (element as Element).ownerDocument?.createElement(
          'script'
        );
        if (!script) return;

        script.setAttribute('type', 'application/json');
        script.setAttribute('data-island', instanceId);
        parentElement.insertBefore(script, (element as Element).nextSibling);
      }
    },

    /**
     * Lifecycle: onAttach
     *
     * For island fragments: wraps in div with script tag marker
     * For regular fragments: delegates to base adapter (adds comment markers)
     */
    onAttach: (ref, parentElement) => {
      if (ref.status !== STATUS_FRAGMENT) return;

      const parent = parentElement as HTMLElement;
      const frag = ref as FragmentRef<HTMLElement> & {
        __islandMeta?: IslandNodeMeta;
        __islandId: string;
      };

      const meta = frag.__islandMeta;

      if (meta) {
        // Island fragment - wrap with div and script tag
        if (!frag.firstChild || !frag.lastChild) return;

        const firstNode = getFirstDOMNode(frag.firstChild);
        const lastNode = getLastDOMNode(frag.lastChild);
        if (!firstNode || !lastNode) return;

        // Register island
        const instanceId = registerIsland(
          meta.type,
          meta.props,
          STATUS_FRAGMENT
        );
        frag.__islandId = instanceId;

        // Create wrapper and markers
        const doc = parent.ownerDocument;
        const wrapper = doc.createElement('div');
        const startComment = doc.createComment('fragment-start');
        const endComment = doc.createComment('fragment-end');
        const scriptTag = doc.createElement('script');
        scriptTag.setAttribute('type', 'application/json');
        scriptTag.setAttribute('data-island', instanceId);

        // Build wrapper: insert before first, then move children into it
        parent.insertBefore(wrapper, firstNode);
        wrapper.appendChild(startComment);

        let current: Node | null = firstNode;
        while (current) {
          const next: Node | null = current.nextSibling;
          wrapper.appendChild(current);
          if (current === lastNode) break;
          current = next;
        }

        wrapper.appendChild(endComment);
        wrapper.appendChild(scriptTag);
        return;
      }

      // Non-island fragment - delegate to base adapter for comment markers
      base.onAttach?.(ref, parentElement);
    },
  };
}
