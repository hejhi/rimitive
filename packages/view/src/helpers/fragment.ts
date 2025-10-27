/**
 * Fragment creation helper for userland reconciliation
 *
 * Fragments allow users to create custom reconciliation helpers (like map, show, etc.)
 * without needing to understand FragmentRef internals.
 */

import type { ElementRef, NodeRef, FragmentRef } from '../types';
import { STATUS_FRAGMENT } from '../types';

/**
 * Initialization function provided by user
 *
 * Called when the fragment is attached to the DOM.
 * Returns a cleanup/dispose function (or void).
 *
 * @param parent - The parent element to attach to
 * @param nextSibling - The next sibling for insertion point calculation
 * @returns Cleanup function to be called when fragment is disposed
 */
export type FragmentInitFn<TElement> = (
  parent: ElementRef<TElement>,
  nextSibling?: NodeRef<TElement> | null
) => (() => void) | void;

/**
 * Identifiable fragment factory wrapper
 *
 * This class wraps user-provided initialization logic and provides
 * a type-safe way to identify fragment factories (via instanceof).
 */
export class FragmentFactory<TElement> {
  constructor(private init: FragmentInitFn<TElement>) {}

  /**
   * Create and initialize the fragment
   *
   * Internal use only - called by processChildren during backward pass.
   * Creates the FragmentRef structure and calls user's initialization logic.
   */
  create(
    parent: ElementRef<TElement>,
    nextSibling?: NodeRef<TElement> | null
  ): FragmentRef<TElement> {
    // Create the FragmentRef structure (user never sees this)
    const fragRef: FragmentRef<TElement> = {
      status: STATUS_FRAGMENT,
      element: null,
      prev: undefined,
      next: undefined,
      firstChild: undefined,
      lastChild: undefined,
    };

    // Call user's initialization logic
    const dispose = this.init(parent, nextSibling);

    // Store dispose if provided
    if (dispose) {
      fragRef.dispose = dispose;
    }

    return fragRef;
  }
}

/**
 * Create a fragment factory for userland reconciliation helpers
 *
 * Users only provide initialization logic - FragmentRef is handled internally.
 * The initialization function receives the parent element and next sibling,
 * and should return a cleanup function.
 *
 * @example
 * ```typescript
 * function map(items) {
 *   return createFragment((parent, nextSibling) => {
 *     // Your reconciliation logic here
 *     const cleanup = scopedEffect(() => {
 *       // reactive updates
 *     });
 *
 *     // Return cleanup function
 *     return cleanup;
 *   });
 * }
 * ```
 *
 * @param init - Initialization function that returns optional cleanup
 * @returns FragmentFactory that can be used as a child in el()
 */
export function createFragment<TElement>(
  init: FragmentInitFn<TElement>
): FragmentFactory<TElement> {
  return new FragmentFactory(init);
}

/**
 * Type guard to check if a value is a fragment factory
 *
 * @param value - Value to check
 * @returns True if value is a FragmentFactory instance
 */
export function isFragmentFactory<TElement>(
  value: unknown
): value is FragmentFactory<TElement> {
  return value instanceof FragmentFactory;
}
