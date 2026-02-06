/**
 * Async Fragment Utilities
 *
 * These utilities work with AsyncFragment nodes created by load() to enable
 * server-side resolution and client-side hydration triggering.
 *
 * Used by both server and client code.
 */

import type { NodeRef } from '@rimitive/view/types';
import { STATUS_FRAGMENT, STATUS_ELEMENT } from '@rimitive/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  type AsyncFragment,
} from '@rimitive/view/load';
import {
  ERROR_BOUNDARY,
  isErrorBoundaryFragment,
  type ErrorBoundaryMeta,
  type ErrorBoundaryFragment,
} from '@rimitive/view/error-boundary';

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
 * Result of collecting async fragments with error boundary mappings.
 */
export type FragmentsWithBoundaries<TElement> = {
  fragments: AsyncFragment<TElement>[];
  boundaryMap: Map<AsyncFragment<TElement>, ErrorBoundaryMeta>;
};

/**
 * Collect async fragments and map each to its nearest error boundary ancestor.
 *
 * Walks the tree depth-first, maintaining a stack of error boundary ancestors.
 * Each async fragment is mapped to the closest enclosing error boundary (if any).
 * Fragments without an error boundary ancestor are not in the map.
 */
export function collectFragmentsWithBoundaries<TElement>(
  nodeRef: NodeRef<TElement>
): FragmentsWithBoundaries<TElement> {
  const fragments: AsyncFragment<TElement>[] = [];
  const boundaryMap = new Map<AsyncFragment<TElement>, ErrorBoundaryMeta>();

  function walk(
    node: NodeRef<TElement> | null,
    currentBoundary: ErrorBoundaryMeta | null
  ): void {
    if (!node) return;

    // Check if this node is an error boundary — it becomes the new closest boundary for descendants
    let boundary = currentBoundary;
    if (isErrorBoundaryFragment(node)) {
      boundary = (node as ErrorBoundaryFragment)[ERROR_BOUNDARY];
    }

    // If this is an async fragment, record it and its closest boundary
    if (isAsyncFragment(node)) {
      fragments.push(node as AsyncFragment<TElement>);
      if (boundary) {
        boundaryMap.set(node as AsyncFragment<TElement>, boundary);
      }
    }

    // Walk children
    if (node.status === STATUS_FRAGMENT || node.status === STATUS_ELEMENT) {
      let child = node.firstChild;
      while (child) {
        walk(child, boundary);
        child = child.next;
      }
    }
  }

  walk(nodeRef, null);
  return { fragments, boundaryMap };
}

/**
 * Trigger an async fragment to start fetching.
 *
 * Used by withAsyncSupport to start data fetching for async fragments
 * during client-side rendering (post-hydration navigation).
 *
 * @example
 * ```ts
 * triggerAsyncFragment(fragment);
 * ```
 */
export function triggerAsyncFragment<TElement>(
  fragment: AsyncFragment<TElement>
): void {
  fragment[ASYNC_FRAGMENT].trigger();
}
