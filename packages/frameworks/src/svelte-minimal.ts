/**
 * @fileoverview Minimal Svelte integration for Lattice - Pure performance
 * 
 * The absolute simplest integration that gives us Lattice's raw performance.
 * Just return the slice directly - let Svelte and Lattice handle everything.
 */

import type { SliceHandle } from '@lattice/core';

/**
 * Use a Lattice slice in Svelte - just returns the slice handle directly.
 *
 * When you call sliceHandle() in a Svelte template, Svelte tracks it as a 
 * dependency and Lattice's reactivity system handles updates.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useSlice } from '@lattice/frameworks/svelte-minimal';
 *
 *   const counter = useSlice(counterSlice);
 *   const user = useSlice(userSlice);
 * </script>
 *
 * <div>Count: {counter().value()}</div>
 * <div>User: {user().name()}</div>
 * <button on:click={() => counter().increment()}>+</button>
 * ```
 */
export function useSlice<T>(sliceHandle: SliceHandle<T>): SliceHandle<T> {
  // That's it. Just return the slice handle.
  // Svelte tracks function calls in templates.
  // Lattice triggers re-renders via its subscription system.
  return sliceHandle;
}

/**
 * Select a specific value from a slice.
 *
 * @example
 * ```svelte
 * <script>
 *   import { select } from '@lattice/frameworks/svelte-minimal';
 *
 *   const count = select(counterSlice, c => c.value());
 *   const userName = select(userSlice, u => u.name());
 * </script>
 *
 * <div>Count: {count()}</div>
 * <div>Name: {userName()}</div>
 * ```
 */
export function select<T, U>(
  sliceHandle: SliceHandle<T>,
  selector: (value: T) => U
): () => U {
  return () => selector(sliceHandle());
}

/**
 * Combine multiple slices into a single computed value.
 *
 * @example
 * ```svelte
 * <script>
 *   import { combine } from '@lattice/frameworks/svelte-minimal';
 *
 *   const dashboard = combine(
 *     { counter: counterSlice, user: userSlice },
 *     ({ counter, user }) => ({
 *       greeting: `Hello ${user.name()}!`,
 *       count: counter.value()
 *     })
 *   );
 * </script>
 *
 * <h1>{dashboard().greeting}</h1>
 * <p>Count: {dashboard().count}</p>
 * ```
 */
export function combine<
  TSlices extends Record<string, SliceHandle<any>>,
  TResult
>(
  slices: TSlices,
  combineFn: (values: {
    [K in keyof TSlices]: TSlices[K] extends SliceHandle<infer T> ? T : never;
  }) => TResult
): () => TResult {
  return () => {
    const values: any = {};
    for (const [key, slice] of Object.entries(slices)) {
      values[key] = slice();
    }
    return combineFn(values);
  };
}