import type { ElementRef, NodeRef, FragmentRef } from '../types';
import { STATUS_FRAGMENT } from '../types';

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
      firstChild: undefined,
      lastChild: undefined,
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

  return { createFragment };
}
