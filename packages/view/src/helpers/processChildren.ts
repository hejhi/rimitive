/**
 * Process children into linked list and initialize fragments
 *
 * Single-pass algorithm:
 * 1. Forward pass: Build doubly-linked list including fragments
 * 2. Initialize fragments after all refs are linked
 */

import type {
  NodeRef,
  ElementRef,
  ElRefSpecChild,
  FragmentRef,
  RefSpec,
  ParentContext,
} from '../types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_SPEC_MASK } from '../types';
import type { Renderer, RendererConfig } from '../renderer';

export function createProcessChildren<TConfig extends RendererConfig>(opts: {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TConfig>;
}) {
  type TNode = TConfig['baseElement'];
  type ViewChild = RefSpec<TNode> | FragmentRef<TNode>;

  const { scopedEffect, renderer } = opts;
  const createTextEffect =
    (child: () => string | number, textNode: TNode) => () => {
      const value = child();
      const stringValue = value == null ? '' : String(value);
      renderer.setProperty(textNode, 'value', stringValue);
    };

  const handleChild = (
    parentRef: ElementRef<TNode>,
    child: ElRefSpecChild,
    api?: unknown,
    parentContext?: ParentContext<TNode>
  ): NodeRef<TNode> | null => {
    const element = parentRef.element;
    const childType = typeof child;

    // Skip null/undefined/false
    if (child == null || childType === 'boolean') return null;

    // Static primitive (string, number)
    if (childType === 'string' || childType === 'number') {
      const textNode = renderer.createNode('text', {
        value: String(child as string | number),
      });
      renderer.appendChild(element, textNode);
      return null; // Text nodes don't participate in ref node chain
    }

    const spec = child as ViewChild;

    if (
      (childType === 'function' || childType === 'object') &&
      'status' in spec
    ) {
      if (spec.status === STATUS_FRAGMENT) return spec;

      if (spec.status & STATUS_SPEC_MASK) {
        // Pass parentContext to child's create() for renderer composition
        const refSpec = spec as RefSpec<TNode>;
        const childRef = refSpec.create(
          api,
          {} as Record<string, never>,
          parentContext
        );
        // Only append actual DOM nodes (elements), not fragments
        if (childRef.status === STATUS_ELEMENT) {
          renderer.appendChild(element, childRef.element);
          // Lifecycle hook: onCreate for elements (e.g., SSR adds island markers)
          renderer.onCreate?.(childRef, element);
        } else if (childRef.status === STATUS_FRAGMENT) {
          // Lifecycle hook: onCreate for fragments (e.g., hydration skips past content)
          renderer.onCreate?.(childRef, element);
        }
        return childRef;
      }
    }

    // Bare function (reactive computed or effect) - wrap in scopedEffect
    if (childType === 'function') {
      const textNode = renderer.createNode('text', { value: '' });
      scopedEffect(createTextEffect(child as () => string, textNode));
      renderer.appendChild(element, textNode);
      return null;
    }

    return null; // Default case
  };

  const processChildren = (
    parent: ElementRef<TNode>,
    children: ElRefSpecChild[],
    api?: unknown,
    parentContext?: ParentContext<TNode>
  ): void => {
    let firstChildRef: NodeRef<TNode> | null = null;
    let lastChildRef: NodeRef<TNode> | null = null;

    // Forward pass: create refs and build doubly-linked list (including fragments)
    for (const child of children) {
      const refNode = handleChild(parent, child, api, parentContext);

      if (!refNode) continue;

      // Track first child
      if (!firstChildRef) firstChildRef = refNode;

      // Set parent and link into doubly-linked list
      refNode.parent = parent;
      refNode.prev = lastChildRef ?? null;

      if (lastChildRef) {
        lastChildRef.next = refNode;
      }

      lastChildRef = refNode;
    }

    // Set last child's next to null and store children on parent
    if (lastChildRef) lastChildRef.next = null;
    parent.firstChild = firstChildRef;
    parent.lastChild = lastChildRef;

    // Unwind: walk backwards attaching fragments
    while (lastChildRef) {
      if (lastChildRef.status === STATUS_FRAGMENT) {
        // Get next sibling's element for position computation
        const nextRef = lastChildRef.next;
        const nextElement =
          nextRef?.status === STATUS_ELEMENT
            ? nextRef.element
            : nextRef?.status === STATUS_FRAGMENT
              ? (nextRef.firstChild?.element ?? null)
              : null;

        // Lifecycle hook: beforeAttach for fragments (e.g., hydration seeks to position)
        renderer.beforeAttach?.(lastChildRef, parent.element, nextElement);

        lastChildRef.attach(parent, lastChildRef.next, api);

        // Lifecycle hook: onAttach for fragments (e.g., SSR adds markers)
        renderer.onAttach?.(lastChildRef, parent.element);
      }
      lastChildRef = lastChildRef.prev;
    }
  };

  return {
    processChildren,
    handleChild,
  };
}
