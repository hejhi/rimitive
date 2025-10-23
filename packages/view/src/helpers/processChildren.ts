/**
 * Process children into linked list and attach fragments
 *
 * Two-pass algorithm:
 * 1. Forward pass: Build intrusive linked list, append element children
 * 2. Backward pass: Attach fragment children with correct insertion points
 */

import type { NodeRef, ElementRef, ElRefSpecChild, Disposable } from '../types';
import { isElementRef, isFragmentRef, isReactive, isRefSpec } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';

export function createProcessChildren<TElement extends RendererElement, TText extends TextNode>(opts: {
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  trackInScope: (disposable: Disposable) => void;
}) {
  const { effect, renderer, trackInScope } = opts;

  const handleChild = (
    parentRef: ElementRef<TElement>,
    child: ElRefSpecChild<TElement>
  ): NodeRef<TElement> | null => {
    const element = parentRef.element;
    const childType = typeof child;

    // Skip null/undefined/false
    if (child == null || child === false || childType === 'boolean')
      return null;

    // Static primitive (string, number)
    if (childType === 'string' || childType === 'number') {
      const textNode = renderer.createTextNode(String(child));
      renderer.appendChild(element, textNode);
      return null; // Text nodes don't participate in ref node chain
    }

    if (childType === 'function') {
      // Element ref (from el()) - instantiate blueprint
      if (isRefSpec<TElement>(child)) {
        const childRef = child.create();

        // Append element if this is an ElementRef (fragments get attached later)
        if (isElementRef(childRef))
          renderer.appendChild(element, childRef.element);

        return childRef;
      }

      // The only other functions allowed are reactives
      if (isReactive(child)) {
        const textNode = renderer.createTextNode('');
        const dispose = effect(() => {
          const value = child();
          // Convert to string, handling null/undefined and primitives only
          const stringValue =
            value == null ? '' : String(value as string | number | boolean);
          renderer.updateTextNode(textNode, stringValue);
        });

        // Track effect for cleanup when element is removed
        trackInScope({ dispose });
        renderer.appendChild(element, textNode);
        return null; // Text nodes don't participate in ref node chain
      }
    }

    return null; // Default case
  }

  const processChildren = (
    parent: ElementRef<TElement>,
    children: ElRefSpecChild<TElement>[]
  ): void => {
    // Forward pass: build intrusive linked list
    let lastChildRef: NodeRef<TElement> | undefined;

    for (const child of children) {
      const refNode = handleChild(parent, child);

      if (!refNode) continue;
      if (lastChildRef) {
        lastChildRef.next = refNode;
        refNode.prev = lastChildRef;
      }
      lastChildRef = refNode;
    }

    // Backward pass: attach fragments with correct insertion points
    if (!lastChildRef) return;
    let nextRef: NodeRef<TElement> | null = null;

    do {
      if (isFragmentRef(lastChildRef)) lastChildRef.attach(parent, nextRef);
      else nextRef = lastChildRef;

      lastChildRef = lastChildRef.prev;
    } while (lastChildRef);
  };

  return {
    processChildren,
    handleChild
  }
}
