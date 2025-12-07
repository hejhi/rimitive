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
import type { Adapter, AdapterConfig } from '../adapter';

export type ProcessChildren<TElement> = {
  processChildren: (
    parent: ElementRef<TElement>,
    children: ElRefSpecChild[],
    svc?: unknown,
    parentContext?: ParentContext<TElement>
  ) => void;
  handleChild: (
    parentRef: ElementRef<TElement>,
    child: ElRefSpecChild,
    svc?: unknown,
    parentContext?: ParentContext<TElement>
  ) => NodeRef<TElement> | null;
};

export function createProcessChildren<TConfig extends AdapterConfig>(opts: {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  adapter: Adapter<TConfig>;
}): ProcessChildren<TConfig['baseElement']> {
  type TNode = TConfig['baseElement'];
  type ViewChild = RefSpec<TNode> | FragmentRef<TNode>;

  const { scopedEffect, adapter } = opts;
  const createTextEffect =
    (child: () => string | number, textNode: TNode) => () => {
      const value = child();
      const stringValue = value == null ? '' : String(value);
      adapter.setProperty(textNode, 'value', stringValue);
    };

  const handleChild = (
    parentRef: ElementRef<TNode>,
    child: ElRefSpecChild,
    svc?: unknown,
    parentContext?: ParentContext<TNode>
  ): NodeRef<TNode> | null => {
    const element = parentRef.element;
    const childType = typeof child;

    // Skip null/undefined/false
    if (child == null || childType === 'boolean') return null;

    // Static primitive (string, number)
    if (childType === 'string' || childType === 'number') {
      const textNode = adapter.createNode('text', {
        value: String(child as string | number),
      });
      adapter.appendChild(element, textNode);
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
          svc,
          {} as Record<string, never>,
          parentContext
        );
        // Only append actual DOM nodes (elements), not fragments
        if (childRef.status === STATUS_ELEMENT) {
          adapter.appendChild(element, childRef.element);
          // Lifecycle hook: onCreate for elements (e.g., SSR adds island markers)
          adapter.onCreate?.(childRef, element);
        } else if (childRef.status === STATUS_FRAGMENT) {
          // Lifecycle hook: onCreate for fragments (e.g., hydration skips past content)
          adapter.onCreate?.(childRef, element);
        }
        return childRef;
      }
    }

    // Bare function (reactive computed or effect) - wrap in scopedEffect
    if (childType === 'function') {
      const textNode = adapter.createNode('text', { value: '' });
      scopedEffect(createTextEffect(child as () => string, textNode));
      adapter.appendChild(element, textNode);
      return null;
    }

    return null; // Default case
  };

  const processChildren = (
    parent: ElementRef<TNode>,
    children: ElRefSpecChild[],
    svc?: unknown,
    parentContext?: ParentContext<TNode>
  ): void => {
    let firstChildRef: NodeRef<TNode> | null = null;
    let lastChildRef: NodeRef<TNode> | null = null;

    // Forward pass: create refs and build doubly-linked list (including fragments)
    for (const child of children) {
      const refNode = handleChild(parent, child, svc, parentContext);

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
        adapter.beforeAttach?.(lastChildRef, parent.element, nextElement);

        lastChildRef.attach(parent, lastChildRef.next, svc);

        // Lifecycle hook: onAttach for fragments (e.g., SSR adds markers)
        adapter.onAttach?.(lastChildRef, parent.element);
      }
      lastChildRef = lastChildRef.prev;
    }
  };

  return {
    processChildren,
    handleChild,
  };
}
