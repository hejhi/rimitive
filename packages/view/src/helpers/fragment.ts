import type { ElementRef, NodeRef, FragmentRef } from '../types';
import { STATUS_FRAGMENT } from '../types';

export type FragmentInitFn<TElement> = (
  parent: ElementRef<TElement>,
  nextSibling?: NodeRef<TElement> | null
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
    prev: undefined,
    next: undefined,
    firstChild: undefined,
    lastChild: undefined,
    attach: (
      parent: ElementRef<TElement>,
      nextSibling?: NodeRef<TElement> | null
    ) => {
      // Call user's initialization logic
      const dispose = init(parent, nextSibling);

      // Store dispose if provided
      if (dispose) fragRef.dispose = dispose;

      return fragRef;
    },
  };

  return fragRef;
}
