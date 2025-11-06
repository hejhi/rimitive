import type { ElementRef, NodeRef, FragmentRef } from '../types';
import { STATUS_FRAGMENT, STATUS_ELEMENT, isFragmentRef, isElementRef } from '../types';

export type FragmentInitFn<TElement> = (
  parent: ElementRef<TElement>,
  nextSibling: NodeRef<TElement> | null,
  api?: unknown
) => (() => void) | void;

/**
 * Create a fragment factory for userland reconciliation helpers
 */
export function createFragment<TElement>(
  init: FragmentInitFn<TElement>
): FragmentRef<TElement> {
  const fragRef: FragmentRef<TElement> = {
    status: STATUS_FRAGMENT,
    element: null,
    next: undefined,
    firstChild: undefined,
    attach: (
      parent: ElementRef<unknown>,
      nextSibling: NodeRef<unknown> | null = null,
      api?: unknown
    ) => {
      // Call user's initialization logic - cast to TElement as all elements are compatible at runtime
      const dispose = init(
        parent as ElementRef<TElement>,
        nextSibling as NodeRef<TElement> | null,
        api
      );

      // Store dispose if provided
      if (dispose) fragRef.dispose = dispose;

      return fragRef;
    },
  };

  return fragRef;
}

/**
 * Resolve the next DOM element from a NodeRef chain.
 * Walks the `next` chain to find the first actual element, skipping empty fragments.
 *
 * @param ref - Starting NodeRef (typically fragment.next)
 * @returns The next DOM element, or null if end of chain
 */
export function resolveNextRef<TElement>(
  ref: NodeRef<TElement> | undefined | null
): NodeRef<TElement> | null {
  let current = ref;
  while (current) {
    if (current.status === STATUS_ELEMENT) return current;

    // FragmentRef - try to get first child element
    if (current.firstChild) {
      const firstChild = current.firstChild as NodeRef<TElement>;

      if (isFragmentRef(firstChild) || isElementRef(firstChild)) return firstChild;
    }

    current = current.next as NodeRef<TElement> | null | undefined; // Empty fragment - skip to next sibling
  }

  return null;
}
