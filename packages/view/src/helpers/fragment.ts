import type { ElementRef, NodeRef, FragmentRef } from '../types';
import { STATUS_FRAGMENT, STATUS_ELEMENT } from '../types';

export type FragmentInitFn<TElement> = (
  parent: ElementRef<TElement>,
  nextSibling: NodeRef<TElement> | null,
  api?: unknown
) => (() => void) | void;

/**
 * Fragment helpers factory - creates local copies for each consumer module
 * This pattern enables bundler inlining while maintaining code reusability
 */
export function createFragmentHelpers() {
  /**
   * Create a fragment factory for userland reconciliation helpers
   */
  function createFragment<TElement>(
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
        init(
          parent as ElementRef<TElement>,
          nextSibling as NodeRef<TElement> | null,
          api
        );

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
  function resolveNextRef<TElement>(
    ref: NodeRef<TElement> | undefined | null
  ): NodeRef<TElement> | null {
    let current = ref;
    while (current) {
      if (current.status === STATUS_ELEMENT) return current;

      // Only FragmentRef has firstChild, skip CommentRef
      const firstChild = current.status === STATUS_FRAGMENT ? current.firstChild : undefined;

      // FragmentRef - try to get first child element
      if (firstChild) {
        const status = firstChild.status;

        if (status === STATUS_FRAGMENT || status === STATUS_ELEMENT) {
          return firstChild as NodeRef<TElement>;
        }
      }

      current = current.next as NodeRef<TElement> | null | undefined; // Empty fragment - skip to next sibling
    }

    return null;
  }

  return { createFragment, resolveNextRef };
}
