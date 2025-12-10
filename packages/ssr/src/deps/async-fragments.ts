/**
 * Async fragment utilities for SSR
 *
 * These utilities work with AsyncFragment nodes created by load() to enable
 * server-side resolution and client-side hydration triggering.
 */

import type { NodeRef, RefSpec } from '@lattice/view/types';
import { STATUS_FRAGMENT, STATUS_ELEMENT } from '@lattice/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  type AsyncFragment,
} from '@lattice/view/load';

// Re-export for convenience
export { isAsyncFragment, ASYNC_FRAGMENT, type AsyncFragment };

/**
 * Collect all async fragments in a node tree.
 *
 * Walks the node tree recursively and returns all fragments
 * that have async metadata (created by load()).
 *
 * @example
 * ```ts
 * const fragments = collectAsyncFragments(rootNode);
 * for (const fragment of fragments) {
 *   await fragment[ASYNC_FRAGMENT].resolve();
 * }
 * ```
 */
export function collectAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): AsyncFragment<TElement>[] {
  const fragments: AsyncFragment<TElement>[] = [];

  function walk(node: NodeRef<TElement> | null): void {
    if (!node) return;
    if (isAsyncFragment(node)) fragments.push(node as AsyncFragment<TElement>);
    if (node.status === STATUS_FRAGMENT || node.status === STATUS_ELEMENT) {
      let child = node.firstChild;
      while (child) {
        walk(child);
        child = child.next;
      }
    }
  }

  walk(nodeRef);
  return fragments;
}

/**
 * Resolve an async fragment and return its ready RefSpec.
 *
 * Used during SSR to await data fetching and get the resolved content.
 *
 * @example
 * ```ts
 * const resolvedSpec = await resolveAsyncFragment(fragment);
 * const resolvedNode = mount(resolvedSpec);
 * ```
 */
export async function resolveAsyncFragment<TElement>(
  fragment: AsyncFragment<TElement>
): Promise<RefSpec<TElement>> {
  const { refSpec } = await fragment[ASYNC_FRAGMENT].resolve();
  return refSpec as RefSpec<TElement>;
}

/**
 * Trigger an async fragment to start fetching.
 *
 * Used during client-side hydration to start data fetching for
 * fragments that weren't resolved on the server.
 *
 * @example
 * ```ts
 * // During hydration
 * triggerAsyncFragment(fragment);
 * ```
 */
export function triggerAsyncFragment<TElement>(
  fragment: AsyncFragment<TElement>
): void {
  fragment[ASYNC_FRAGMENT].trigger();
}

/**
 * Trigger all async fragments in a node tree to start fetching.
 *
 * Convenience function that collects all async fragments and triggers them.
 * Used during client-side hydration.
 *
 * @example
 * ```ts
 * // After hydration, trigger any pending async boundaries
 * triggerAsyncFragments(rootNode);
 * ```
 */
export function triggerAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): void {
  for (const fragment of collectAsyncFragments(nodeRef)) {
    triggerAsyncFragment(fragment);
  }
}
