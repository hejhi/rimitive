/**
 * Process children into linked list and attach fragments
 *
 * Two-pass algorithm:
 * 1. Forward pass: Build intrusive linked list, append element children (skip fragment factories)
 * 2. Backward pass: Initialize fragment factories with correct insertion points
 */

import type { NodeRef, ElementRef, ElRefSpecChild } from '../types';
import { isElementRef, isReactive, isRefSpec } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import { isFragmentFactory } from './fragment';

export function createProcessChildren<TElement extends RendererElement, TText extends TextNode>(opts: {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
}) {
  const { scopedEffect, renderer } = opts;

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
      const textNode = renderer.createTextNode(String(child as string | number));
      renderer.appendChild(element, textNode);
      return null; // Text nodes don't participate in ref node chain
    }

    if (childType === 'function') {
      // Element ref (from el()) - instantiate blueprint
      if (isRefSpec<TElement>(child)) {
        const childRef = child.create();

        // Append element if this is an ElementRef
        if (isElementRef(childRef)) renderer.appendChild(element, childRef.element);

        return childRef;
      }

      // Fragment factory - skip in forward pass, handle in backward pass
      if (isFragmentFactory<TElement>(child)) {
        return null;
      }

      // The only other functions allowed are reactives
      if (isReactive(child)) {
        const textNode = renderer.createTextNode('');
        // Auto-tracked in active scope
        scopedEffect(() => {
          const value = child();
          // Convert to string, handling null/undefined and primitives only
          const stringValue =
            value == null ? '' : String(value as string | number | boolean);
          renderer.updateTextNode(textNode, stringValue);
        });

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
    // Map to track which child produced which NodeRef
    const childNodes = new Map<number, NodeRef<TElement>>();
    let lastChildRef: NodeRef<TElement> | undefined;

    // Forward pass: build intrusive linked list (skip fragment factories)
    for (let i = 0; i < children.length; i++) {
      const refNode = handleChild(parent, children[i]!);

      if (!refNode) continue;

      childNodes.set(i, refNode);

      if (lastChildRef) {
        lastChildRef.next = refNode;
        refNode.prev = lastChildRef;
      }
      lastChildRef = refNode;
    }

    // Backward pass: initialize fragment factories with correct insertion points
    let nextRef: NodeRef<TElement> | null = null;

    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]!;

      // Fragment factory - call create() with parent and nextSibling
      if (isFragmentFactory<TElement>(child)) {
        child.create(parent, nextRef);
        // FragmentRef is now initialized and attached to DOM
      }

      // Update insertion point for next factory
      const nodeRef = childNodes.get(i);
      if (nodeRef && isElementRef(nodeRef)) {
        nextRef = nodeRef;
      }
    }
  };

  return {
    processChildren,
    handleChild
  }
}
