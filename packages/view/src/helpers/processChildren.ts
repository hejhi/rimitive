/**
 * Process children into linked list and attach fragments
 *
 * Two-pass algorithm:
 * 1. Forward pass: Build intrusive linked list, append element children (skip fragments)
 * 2. Backward pass: Attach fragments with correct insertion points
 */

import type { NodeRef, ElementRef, ElRefSpecChild, FragmentRef, RefSpec } from '../types';
import { isElementRef, isFragmentRef, STATUS_REF_SPEC } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';

export function createProcessChildren<TElement extends RendererElement, TText extends TextNode>(opts: {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
}) {
  const { scopedEffect, renderer } = opts;
  const createTextEffect =
    (child: () => string | number, text: TText) =>
    () => {
      const value = child();
      const stringValue = value == null ? '' : String(value);
      renderer.updateTextNode(text, stringValue);
    };

  const handleChild = (
    parentRef: ElementRef<TElement>,
    child: ElRefSpecChild<TElement>
  ): NodeRef<TElement> | null => {
    const element = parentRef.element;
    const childType = typeof child;

    // Skip null/undefined/false
    if (child == null || childType === 'boolean') return null;

    // Static primitive (string, number)
    if (childType === 'string' || childType === 'number') {
      const textNode = renderer.createTextNode(String(child as string | number));
      renderer.appendChild(element, textNode);
      return null; // Text nodes don't participate in ref node chain
    }

    if (childType === 'function') {
      const fn = child as RefSpec<TElement>;

      // RefSpec - our primitive
      if (fn.status === STATUS_REF_SPEC) {
        const childRef = fn.create();
        if (isElementRef(childRef)) renderer.appendChild(element, childRef.element);
        return childRef;
      }

      // Any other function - wrap in scopedEffect (auto-tracks if reactive)
      const textNode = renderer.createTextNode('');
      scopedEffect(createTextEffect(child as () => string, textNode));
      renderer.appendChild(element, textNode);
      return null;
    }

    // Fragment ref - return it for backward pass handling
    if (
      childType === 'object' &&
      child !== null &&
      isFragmentRef<TElement>(child as NodeRef<TElement>)
    ) return child as FragmentRef<TElement>;

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

      if (lastChildRef) lastChildRef.next = refNode;

      lastChildRef = refNode;
    }

    // Backward pass: attach fragments with correct insertion points
    let nextRef: NodeRef<TElement> | null = null;

    for (let i = children.length - 1; i >= 0; i--) {
      const nodeRef = childNodes.get(i);

      // Fragment ref - call attach with parent and nextSibling
      if (nodeRef && isFragmentRef(nodeRef)) nodeRef.attach(parent, nextRef);

      // Update insertion point for next fragment
      if (nodeRef && isElementRef(nodeRef)) { nextRef = nodeRef };
    }
  };

  return {
    processChildren,
    handleChild
  }
}
