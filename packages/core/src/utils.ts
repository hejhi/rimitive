/**
 * Utility functions for @lattice/core
 *
 * These utilities provide access to internal metadata for framework
 * integration, testing, and developer tools, as well as common
 * convenience functions for slice creation.
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

/**
 * Create a selector function that picks specific properties from state.
 *
 * This utility reduces boilerplate when creating slices that depend on
 * specific state properties. Instead of writing verbose selector functions,
 * you can use this concise syntax.
 *
 * @param keys - The property keys to select from state
 * @returns A selector function that picks the specified properties
 *
 * @example
 * ```typescript
 * import { createStore, select } from '@lattice/core';
 *
 * // Convention: alias as $ for concise usage
 * const $ = select;
 *
 * const createSlice = createStore({
 *   analytics: { pageViews: 1000, users: 250 },
 *   sales: { revenue: 50000, orders: 125 },
 *   ui: { theme: 'light', sidebar: true }
 * });
 *
 * // Single property: instead of (state) => ({ analytics: state.analytics })
 * const analytics = createSlice(
 *   $('analytics'),
 *   ({ analytics }, set) => ({
 *     pageViews: () => analytics().pageViews,
 *     users: () => analytics().users
 *   })
 * );
 *
 * // Multiple properties
 * const business = createSlice(
 *   $('analytics', 'sales'),
 *   ({ analytics, sales }, set) => ({
 *     conversion: () => sales().orders / analytics().users,
 *     revenue: () => sales().revenue
 *   })
 * );
 *
 * // All state: be explicit with full selector when needed
 * const globalSlice = createSlice(
 *   (state) => state, // explicit "select all"
 *   (state, set) => ({
 *     // Access any part of state
 *     totalRevenue: () => state.analytics().pageViews * state.sales().revenue,
 *     reset: () => set(() => initialState) // reset entire state
 *   })
 * );
 * ```
 */
export function select<State, K extends keyof State>(
  ...keys: K[]
): (state: State) => Pick<State, K> {
  return (state: State) => {
    const result = {} as Pick<State, K>;
    for (const key of keys) {
      (result as any)[key] = state[key];
    }
    return result;
  };
}
