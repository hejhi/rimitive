import type { FragmentRef } from '../types';

export type FragmentAttachFn<TElement> = (fragment: FragmentRef<TElement>, api?: unknown) => (() => void) | void;

/**
 * Fragment helpers factory - creates local copies for each consumer module
 * This pattern enables bundler inlining while maintaining code reusability
 */
export function createFragmentHelpers() {
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

  return { attachFragment };
}
