/**
 * Shared node manipulation helpers
 *
 * These helpers encapsulate common patterns for DOM manipulation
 * used across map, match, and other reactive primitives.
 */

import type { NodeRef, ElementRef, LinkedNode, FragmentRef } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_COMMENT } from '../types';
import type { Renderer, RendererConfig } from '../renderer';
import type { CreateScopes } from './scope';
import { linkBefore, unlink } from './linked-list';
import { createFragmentHelpers } from './fragment';

const { initializeFragment } = createFragmentHelpers();

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
   * Handles ElementRef, CommentRef, and FragmentRef correctly.
   *
   * @param parentElement - Parent DOM element
   * @param node - Node to insert (element, comment, or fragment)
   * @param nextSiblingNode - Next sibling node (can be element, comment, fragment, or undefined)
   * @param boundaryNextSibling - Boundary marker for fragments (e.g., from parent fragment)
   * @param api - API context for fragment attachment
   */
  function insertNodeBefore(
    api: unknown,
    parentElement: TElement,
    node: NodeRef<TElement>,
    nextSiblingNode?: NodeRef<TElement> | null,
    boundaryNextSibling?: NodeRef<TElement> | null,
  ): void {
    if (node.status === STATUS_ELEMENT || node.status === STATUS_COMMENT) {
      // Determine the next linked node for doubly-linked list
      // nextSiblingNode if it's a linked node, otherwise boundaryNextSibling
      let nextLinked: LinkedNode<TElement> | undefined | null;
      if (nextSiblingNode && nextSiblingNode.status !== STATUS_FRAGMENT) {
        nextLinked = nextSiblingNode as LinkedNode<TElement>;
      } else if (boundaryNextSibling && boundaryNextSibling.status !== STATUS_FRAGMENT) {
        nextLinked = boundaryNextSibling as LinkedNode<TElement>;
      }

      // Link into doubly-linked list
      linkBefore(node as LinkedNode<TElement>, nextLinked);

      // Insert into DOM - use the element from nextLinked if available
      const nextEl = (nextLinked?.element as TElement | TConfig['comment'] | null | undefined) ?? null;
      renderer.insertBefore(
        parentElement,
        node.element as TElement | TConfig['comment'],
        nextEl
      );
    } else if (node.status === STATUS_FRAGMENT) {
      // Link fragment into parent's doubly-linked list
      const parentRef: ElementRef<TElement> = {
        status: STATUS_ELEMENT,
        element: parentElement,
        parent: null,
        prev: null,
        next: null,
      };

      node.parent = parentRef;

      // Determine next sibling for fragment
      const nextSib = nextSiblingNode ?? boundaryNextSibling ?? null;

      // Link fragment into parent's list
      let nextLinked: LinkedNode<TElement> | undefined | null;
      if (nextSib && nextSib.status !== STATUS_FRAGMENT) {
        nextLinked = nextSib as LinkedNode<TElement>;
      }
      linkBefore(node as LinkedNode<TElement>, nextLinked);

      // Initialize fragment (sets up children)
      initializeFragment(node as FragmentRef<TElement>, api);
    }
  }

  /**
   * Remove a node from the DOM and dispose its scope.
   * Handles ElementRef, CommentRef, and FragmentRef correctly.
   *
   * @param parentElement - Parent DOM element
   * @param node - Node to remove (element, comment, or fragment)
   */
  function removeNode(
    parentElement: TElement,
    node: NodeRef<TElement>
  ): void {
    if (node.status === STATUS_ELEMENT || node.status === STATUS_COMMENT) {
      // Unlink from doubly-linked list
      unlink(node as LinkedNode<TElement>);

      // Dispose scope if element
      if (node.status === STATUS_ELEMENT) {
        const scope = getElementScope(node.element);
        if (scope) disposeScope(scope);
      }

      // Remove from DOM
      renderer.removeChild(parentElement, node.element as TElement | TConfig['comment']);
    } else if (node.status === STATUS_FRAGMENT) {
      // Unlink fragment from parent's list
      unlink(node as LinkedNode<TElement>);

      // Remove all children in fragment's own list
      let current = node.firstChild;
      while (current) {
        const next = current.next;

        // Unlink child from fragment's list
        unlink(current);

        // Dispose and remove from DOM
        if (current.status === STATUS_ELEMENT) {
          const scope = getElementScope(current.element);
          if (scope) disposeScope(scope);
          renderer.removeChild(parentElement, current.element);
        } else if (current.status === STATUS_COMMENT) {
          renderer.removeChild(parentElement, current.element as TConfig['comment']);
        }

        if (current === node.lastChild) break;
        current = (next ?? undefined) as typeof current;
      }
    }
  }

  return {
    insertNodeBefore,
    removeNode,
  };
}
