/**
 * Process children into linked list and attach fragments
 *
 * Two-pass algorithm:
 * 1. Forward pass: Build intrusive linked list, append element children (skip fragments)
 * 2. Backward pass: Attach fragments with correct insertion points
 */

import type { NodeRef, ElementRef, ElRefSpecChild, FragmentRef, RefSpec, SealedSpec } from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_SPEC_MASK } from '../types';
import type { Renderer, Element as RendererElement, TextNode, RendererConfig } from '../renderer';


export function createProcessChildren<
  TConfig extends RendererConfig,
  TElement extends RendererElement,
  TText extends TextNode
>(opts: {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TConfig, TElement, TText>;
}) {
  type ViewChild = RefSpec<TElement> | FragmentRef<TElement> | SealedSpec<TElement>;

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
    child: ElRefSpecChild,
    api?: unknown
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

    if (
      (childType === 'function' || childType === 'object') &&
      'status' in (child as ViewChild)
    ) {
      const spec = child as ViewChild;

      if (spec.status === STATUS_FRAGMENT) return spec;

      // RefSpec or SealedSpec - both have .create() method
      if (spec.status & STATUS_SPEC_MASK) {
        const childRef = spec.create(api);
        if (childRef.status === STATUS_ELEMENT) renderer.appendChild(element, childRef.element);
        return childRef;
      }
    }

    // Bare function (reactive computed or effect) - wrap in scopedEffect
    if (childType === 'function') {
      const textNode = renderer.createTextNode('');
      scopedEffect(createTextEffect(child as () => string, textNode));
      renderer.appendChild(element, textNode);
      return null;
    }

    return null; // Default case
  }

  const processChildren = (
    parent: ElementRef<TElement>,
    children: ElRefSpecChild[],
    api?: unknown
  ): void => {
    // Map to track which child produced which NodeRef
    const childNodes = new Map<number, NodeRef<TElement>>();
    let lastChildRef: NodeRef<TElement> | undefined;

    // Forward pass: build intrusive linked list (skip fragment factories)
    for (let i = 0; i < children.length; i++) {
      const refNode = handleChild(parent, children[i]!, api);

      if (!refNode) continue;

      childNodes.set(i, refNode);

      if (lastChildRef) lastChildRef.next = refNode;

      lastChildRef = refNode;
    }

    // Backward pass: attach fragments with correct insertion points
    let nextRef: NodeRef<TElement> | null = null;

    for (let i = children.length - 1; i >= 0; i--) {
      const nodeRef = childNodes.get(i);
      if (!nodeRef) continue;
      const status = nodeRef.status;

      // Fragment ref - call attach with parent, nextSibling, and api for SealedSpec support
      if (status === STATUS_FRAGMENT) nodeRef.attach(parent, nextRef, api);

      // Update insertion point for next fragment
      if (status === STATUS_ELEMENT) { nextRef = nodeRef };
    }
  };

  return {
    processChildren,
    handleChild
  }
}
