/**
 * @fileoverview Compose utility for dependency injection between slices
 *
 * Provides a clean way to compose slices with explicit dependencies.
 * For use with the new createStore API.
 */

import type { StoreTools } from './index';

/**
 * Compose function for dependency injection with createStore pattern.
 * 
 * @param deps - Object mapping names to slice instances
 * @param factory - Function that receives tools and resolved dependencies
 * @returns A factory function compatible with createSlice
 * 
 * @example
 * ```typescript
 * const createSlice = createStore({ count: 0 });
 * 
 * const counter = createSlice(({ get, set }) => ({
 *   increment: () => set({ count: get().count + 1 })
 * }));
 * 
 * const actions = createSlice(
 *   compose(
 *     { counter },
 *     ({ get, set }, { counter }) => ({
 *       incrementTwice: () => {
 *         counter.increment();
 *         counter.increment();
 *       }
 *     })
 *   )
 * );
 * ```
 */
export function compose<
  State,
  Deps extends Record<string, unknown>,
  Result
>(
  deps: Deps,
  factory: (tools: StoreTools<State>, resolvedDeps: Deps) => Result
): (tools: StoreTools<State>) => Result {
  return (tools: StoreTools<State>): Result => {
    return factory(tools, deps);
  };
}
