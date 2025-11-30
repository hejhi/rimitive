/**
 * Shared node manipulation helpers
 *
 * These helpers encapsulate common patterns for DOM manipulation
 * used across map, match, and other reactive primitives.
 */

import type { NodeRef, ElementRef, LinkedNode } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '../types';
import type { Renderer, RendererConfig } from '../renderer';
import type { CreateScopes } from './scope';
import { linkBefore, unlink } from './linked-list';

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
   * Handles ElementRef and FragmentRef correctly.
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
    node: NodeRef<TElement>,
    nextSiblingNode?: NodeRef<TElement> | null,
    boundaryNextSibling?: NodeRef<TElement> | null
  ): void {
    if (node.status === STATUS_ELEMENT) {
      // Determine the next linked node for doubly-linked list
      // nextSiblingNode if it's a linked node, otherwise boundaryNextSibling
      let nextLinked: LinkedNode<TElement> | undefined | null;
      if (nextSiblingNode && nextSiblingNode.status !== STATUS_FRAGMENT) {
        nextLinked = nextSiblingNode as LinkedNode<TElement>;
      } else if (
        boundaryNextSibling &&
        boundaryNextSibling.status !== STATUS_FRAGMENT
      ) {
        nextLinked = boundaryNextSibling as LinkedNode<TElement>;
      }

      // Link into doubly-linked list
      linkBefore(node as LinkedNode<TElement>, nextLinked);

      // Insert into DOM - use the element from nextLinked if available
      const nextEl = nextLinked?.element ?? null;
      renderer.insertBefore(parentElement, node.element, nextEl);

      // Decorate element if renderer supports it (e.g., add island markers)
      renderer.decorateElement?.(node, node.element as TConfig['baseElement']);
    } else if (node.status === STATUS_FRAGMENT) {
      // Link fragment into parent's doubly-linked list
      const parentRef: ElementRef<TElement> = {
        status: STATUS_ELEMENT,
        element: parentElement,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      };

      node.parent = parentRef;

      // Determine next sibling for fragment
      const nextSib = nextSiblingNode ?? boundaryNextSibling ?? null;

      // Link fragment into parent's list
      let nextLinked: LinkedNode<TElement> | undefined | null;
      if (nextSib && nextSib.status !== STATUS_FRAGMENT) {
        nextLinked = nextSib as LinkedNode<TElement>;
      }
      linkBefore(node, nextLinked);

      // Attach fragment (sets up children) and store cleanup function
      const cleanup = node.attach(parentRef, nextSib, api);
      if (cleanup) node.cleanup = cleanup;

      // Decorate fragment with SSR markers if renderer supports it
      renderer.decorateFragment?.(node, parentElement);
    }
  }

  /**
   * Remove a node from the DOM and dispose its scope.
   * Handles ElementRef and FragmentRef correctly, including nested fragments.
   *
   * @param parentElement - Parent DOM element
   * @param node - Node to remove (element or fragment)
   */
  function removeNode(parentElement: TElement, node: NodeRef<TElement>): void {
    if (node.status === STATUS_ELEMENT) {
      // Unlink from doubly-linked list
      unlink(node as LinkedNode<TElement>);

      // Dispose scope
      const scope = getElementScope(node.element);
      if (scope) disposeScope(scope);

      // Remove from DOM
      renderer.removeChild(parentElement, node.element);
    } else if (node.status === STATUS_FRAGMENT) {
      // Call fragment's cleanup function first (disposes effects, etc.)
      // This must happen before removing children so nested fragment cleanups
      // are called in the correct order (parent before children)
      node.cleanup?.();

      // Unlink fragment from parent's list
      unlink(node as LinkedNode<TElement>);

      // Remove all children in fragment's own list
      let current = node.firstChild;
      while (current) {
        const next = current.next;

        // Unlink child from fragment's list
        unlink(current);

        // Dispose and remove from DOM - recurse for nested fragments
        if (current.status === STATUS_ELEMENT) {
          const scope = getElementScope(current.element);
          if (scope) disposeScope(scope);
          renderer.removeChild(parentElement, current.element);
        } else if (current.status === STATUS_FRAGMENT) {
          // Recursively remove nested fragment
          removeNode(parentElement, current);
        }

        if (current === node.lastChild) break;
        current = next as typeof current;
      }
    }
  }

  return {
    insertNodeBefore,
    removeNode,
  };
}
