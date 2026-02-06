/**
 * Async fragment resolution for SSR.
 *
 * Resolves all async fragments in a node tree using pipelined resolution.
 * Shared by renderToStringAsync, renderToData, and renderToStream.
 */

import type { NodeRef } from '@rimitive/view/types';
import {
  ASYNC_FRAGMENT,
  collectAsyncFragments,
  collectFragmentsWithBoundaries,
  type AsyncFragment,
} from '../shared/async-fragments';

/**
 * Resolve all async fragments in a node tree using pipelined resolution.
 *
 * Each resolve() may cause new async fragments to appear (e.g., a load()
 * behind a lazy boundary). Instead of waiting for an entire batch to complete
 * before re-collecting, each resolved fragment immediately triggers a
 * re-collection of the tree. Newly discovered fragments start resolving
 * right away, eliminating cross-iteration wait time.
 *
 * When catchErrors is true and an async fragment is nested inside an error
 * boundary, the boundary's setError() is called with the error instead of
 * silently swallowing it. This allows the fallback UI to render and be
 * streamed to the client. Fragments without an error boundary ancestor
 * still have their errors silently caught (to prevent one failure from
 * breaking the entire stream).
 */
export async function resolveAllAsyncFragments(
  nodeRef: NodeRef<unknown>,
  options?: { catchErrors?: boolean }
): Promise<Set<AsyncFragment<unknown>>> {
  const processed = new Set<AsyncFragment<unknown>>();

  if (options?.catchErrors) {
    const boundaryMap = new Map<
      AsyncFragment<unknown>,
      { setError: (err: unknown) => void; hasError: () => boolean }
    >();

    // Resolve a single fragment, then pipeline newly-discovered children
    const resolveAndPipeline = async (
      fragment: AsyncFragment<unknown>
    ): Promise<void> => {
      if (processed.has(fragment)) return;
      processed.add(fragment);

      try {
        await fragment[ASYNC_FRAGMENT].resolve();
      } catch (err) {
        // If this fragment has an error boundary ancestor, notify it
        const boundary = boundaryMap.get(fragment);
        if (boundary) {
          boundary.setError(err);
        }
        // Otherwise silently catch to avoid breaking the stream
      }

      // After this fragment resolves, check for NEW fragments in the tree
      const result = collectFragmentsWithBoundaries(nodeRef);
      const newFragments = result.fragments.filter((f) => !processed.has(f));

      // Merge new boundary mappings
      for (const [frag, meta] of result.boundaryMap) {
        if (!boundaryMap.has(frag)) {
          boundaryMap.set(frag, meta);
        }
      }

      // Start resolving new fragments immediately (in parallel)
      if (newFragments.length > 0) {
        await Promise.all(newFragments.map(resolveAndPipeline));
      }
    };

    // Collect initial fragments with their error boundary mappings
    const initial = collectFragmentsWithBoundaries(nodeRef);
    for (const [frag, meta] of initial.boundaryMap) {
      boundaryMap.set(frag, meta);
    }

    await Promise.all(initial.fragments.map(resolveAndPipeline));
  } else {
    // Resolve a single fragment, then pipeline newly-discovered children
    const resolveAndPipeline = async (
      fragment: AsyncFragment<unknown>
    ): Promise<void> => {
      if (processed.has(fragment)) return;
      processed.add(fragment);

      await fragment[ASYNC_FRAGMENT].resolve();

      // After this fragment resolves, check for NEW fragments in the tree
      const newFragments = collectAsyncFragments(nodeRef).filter(
        (f) => !processed.has(f)
      );

      // Start resolving new fragments immediately (in parallel)
      if (newFragments.length > 0) {
        await Promise.all(newFragments.map(resolveAndPipeline));
      }
    };

    // Start with initially-known fragments
    const initial = collectAsyncFragments(nodeRef);
    await Promise.all(initial.map(resolveAndPipeline));
  }

  return processed;
}
