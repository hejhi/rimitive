/**
 * Utility functions for @lattice/core
 * 
 * These utilities provide access to internal metadata for framework
 * integration, testing, and developer tools.
 */

import { getSliceMetadata as getMetadata } from './lib/metadata';
import type { SliceHandle } from './runtime-types';

/**
 * Get metadata for a slice (dependencies and subscribe function)
 * 
 * Useful for:
 * - Testing dependency tracking
 * - Framework integrations (React hooks, Vue reactivity, etc.)
 * - Developer tools and debugging
 * - Performance monitoring
 * 
 * @param slice - The slice to get metadata for
 * @returns Metadata object or undefined if not found
 * 
 * @example
 * ```typescript
 * import { createStore } from '@lattice/core';
 * import { getSliceMetadata } from '@lattice/core/utils';
 * 
 * const createSlice = createStore({ count: 0 });
 * const slice = createSlice(
 *   (selectors) => ({ count: selectors.count }),
 *   ({ count }, set) => ({
 *     increment: () => set(
 *       (selectors) => ({ count: selectors.count }),
 *       ({ count }) => ({ count: count() + 1 })
 *     )
 *   })
 * );
 * 
 * const metadata = getSliceMetadata(slice);
 * console.log(metadata?.dependencies); // Set { 'count' }
 * 
 * // Subscribe to changes
 * const unsubscribe = metadata?.subscribe(() => {
 *   console.log('Slice dependencies changed!');
 * });
 * ```
 */
export function getSliceMetadata<Computed>(slice: SliceHandle<Computed>) {
  return getMetadata(slice);
}