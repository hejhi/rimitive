import type { FragmentRef } from '../types';
import { STATUS_FRAGMENT } from '../types';

export type FragmentInitFn<TElement> = (
  fragment: FragmentRef<TElement>,
  api?: unknown
) => (() => void) | void;

// WeakMap to store init functions - keeps them private but accessible
const fragmentInitMap = new WeakMap<FragmentRef<unknown>, FragmentInitFn<unknown>>();

/**
 * Fragment helpers factory - creates local copies for each consumer module
 * This pattern enables bundler inlining while maintaining code reusability
 */
export function createFragmentHelpers() {
  /**
   * Create a fragment factory for userland reconciliation helpers
   * Fragment will be initialized later when parent/next are known
   */
  function createFragment<TElement>(
    init: FragmentInitFn<TElement>
  ): FragmentRef<TElement> {
    const fragRef: FragmentRef<TElement> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: undefined,
      lastChild: undefined,
    };

    // Store init function for later
    fragmentInitMap.set(fragRef as FragmentRef<unknown>, init as FragmentInitFn<unknown>);

    return fragRef;
  }

  /**
   * Initialize a fragment by calling its stored init function
   * Called after parent and next are set during processChildren
   */
  function initializeFragment<TElement>(
    fragment: FragmentRef<TElement>,
    api?: unknown
  ): void {
    const init = fragmentInitMap.get(fragment as FragmentRef<unknown>) as FragmentInitFn<TElement> | undefined;
    if (init) {
      init(fragment, api);
      // Clean up - init only runs once
      fragmentInitMap.delete(fragment as FragmentRef<unknown>);
    }
  }

  return { createFragment, initializeFragment };
}
