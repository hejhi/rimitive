import type { FragmentRef } from '../types';
import { STATUS_FRAGMENT } from '../types';

export type FragmentAttachFn<TElement> = (fragment: FragmentRef<TElement>, api?: unknown) => (() => void) | void;

/**
 * Fragment helpers factory - creates local copies for each consumer module
 * This pattern enables bundler inlining while maintaining code reusability
 */
export function createFragmentHelpers() {
  /**
   * Create a fragment factory for userland reconciliation helpers
   * Fragment will be attached to tree later when parent/next are known
   */
  function createFragment<TElement>(
    attachFn: FragmentAttachFn<TElement>
  ): FragmentRef<TElement> {
    const fragRef: FragmentRef<TElement> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: undefined,
      lastChild: undefined,
      attach: attachFn,
    };

    return fragRef;
  }

  /**
   * Attach a fragment by calling its attach function
   * Called after parent and next are set during processChildren
   */
  function attachFragment<TElement>(
    fragment: FragmentRef<TElement>,
    api?: unknown
  ): void {
    const attachFn = fragment.attach;
    if (attachFn) {
      attachFn(fragment, api);
      // Clean up - attach only runs once
      delete fragment.attach;
    }
  }

  return { createFragment, attachFragment };
}
