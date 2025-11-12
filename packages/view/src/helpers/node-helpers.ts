/**
 * Shared node manipulation helpers
 *
 * These helpers encapsulate common patterns for DOM manipulation
 * used across map, match, and other reactive primitives.
 */

import type { NodeRef, ElementRef, FragmentRef } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '../types';
import type { Renderer, RendererConfig } from '../renderer';
import type { CreateScopes } from './scope';
import { createFragmentHelpers } from './fragment';

const { resolveNextRef } = createFragmentHelpers();

export interface NodeHelperOpts<TConfig extends RendererConfig> {
  renderer: Renderer<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
}

export function createNodeHelpers<TConfig extends RendererConfig>(
  opts: NodeHelperOpts<TConfig>
) {
  type TElement = TConfig['baseElement'];
  const { renderer, disposeScope, getElementScope } = opts;

  /**
   * Insert a node before a reference node in the DOM.
   * Handles both ElementRef and FragmentRef correctly.
   *
   * @param parentElement - Parent DOM element
   * @param node - Node to insert (element or fragment)
   * @param nextSiblingNode - Next sibling node (can be element, fragment, or undefined)
   * @param boundaryNextSibling - Boundary marker for fragments (e.g., from parent fragment)
   * @param api - API context for fragment attachment
   */
  function insertNodeBefore(
    api: unknown,
    parentElement: TElement,
    node: ElementRef<TElement> | FragmentRef<TElement>,
    nextSiblingNode?: NodeRef<TElement> | null,
    boundaryNextSibling?: NodeRef<TElement> | null,
  ): void {
    if (node.status === STATUS_ELEMENT) {
      // Resolve the actual DOM element to insert before
      let nextEl: TElement | null = null;

      if (nextSiblingNode && nextSiblingNode.status === STATUS_ELEMENT) {
        nextEl = nextSiblingNode.element;
      } else if (!nextSiblingNode) {
        // No immediate sibling - use boundary marker
        nextEl = resolveNextRef(boundaryNextSibling)?.element ?? null;
      }

      renderer.insertBefore(parentElement, node.element, nextEl);
    } else if (node.status === STATUS_FRAGMENT) {
      // Fragment handles its own insertion
      const parentRef: ElementRef<TElement> = {
        status: STATUS_ELEMENT,
        element: parentElement,
        next: undefined,
      };
      node.attach(parentRef, nextSiblingNode ?? boundaryNextSibling, api);
    }
  }

  /**
   * Remove a node from the DOM and dispose its scope.
   * Handles both ElementRef and FragmentRef correctly.
   *
   * @param parentElement - Parent DOM element
   * @param node - Node to remove (element or fragment)
   */
  function removeNode(
    parentElement: TElement,
    node: ElementRef<TElement> | FragmentRef<TElement>
  ): void {
    if (node.status === STATUS_ELEMENT) {
      const scope = getElementScope(node.element);
      if (scope) disposeScope(scope);
      renderer.removeChild(parentElement, node.element);
    } else if (node.status === STATUS_FRAGMENT) {
      // Dispose all elements in fragment
      let current = node.firstChild;
      while (current) {
        if (current.status === STATUS_ELEMENT) {
          const elementRef = current as ElementRef<TElement>;
          const scope = getElementScope(elementRef.element);
          if (scope) disposeScope(scope);
          renderer.removeChild(parentElement, elementRef.element);
        }
        current = current.next;
      }
    }
  }

  return {
    insertNodeBefore,
    removeNode,
  };
}
