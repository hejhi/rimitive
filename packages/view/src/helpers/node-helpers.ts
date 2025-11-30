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

      // Lifecycle hook: element created (e.g., SSR adds island markers)
      renderer.onElementCreated?.(node, parentElement);
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

      // Lifecycle hook: after fragment attach (e.g., SSR adds markers)
      renderer.afterFragmentAttach?.(node, parentElement);
    }
  }

  // Linked list stack frame for iterative fragment removal
  interface StackFrame {
    childCursor: LinkedNode<TElement> | null;
    lastChild: LinkedNode<TElement> | null;
    prev: StackFrame | undefined;
  }

  /**
   * Remove a node from the DOM and dispose its scope.
   * Handles ElementRef and FragmentRef correctly, including nested fragments.
   * Uses iterative traversal with linked list stack to avoid allocations.
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
      return;
    }

    // Fragment removal - use iterative traversal with linked list stack
    // Initialize with the root fragment
    node.cleanup?.();
    unlink(node as LinkedNode<TElement>);

    let stack: StackFrame | undefined = {
      childCursor: node.firstChild,
      lastChild: node.lastChild,
      prev: undefined,
    };

    while (stack) {
      const current = stack.childCursor;

      if (!current) {
        // No more children in this fragment, pop stack
        stack = stack.prev;
        continue;
      }

      // Advance cursor before processing (in case we push a new frame)
      stack.childCursor =
        current === stack.lastChild
          ? null
          : (current.next as LinkedNode<TElement> | null);

      // Unlink child from fragment's list
      unlink(current);

      if (current.status === STATUS_ELEMENT) {
        // Element: dispose scope and remove from DOM
        const scope = getElementScope(current.element);
        if (scope) disposeScope(scope);
        renderer.removeChild(parentElement, current.element);
      } else if (current.status === STATUS_FRAGMENT) {
        // Nested fragment: call cleanup first (parent before children order)
        // then push onto stack to process its children
        current.cleanup?.();
        unlink(current as LinkedNode<TElement>);
        stack = {
          childCursor: current.firstChild,
          lastChild: current.lastChild,
          prev: stack,
        };
      }
    }
  }

  return {
    insertNodeBefore,
    removeNode,
  };
}
