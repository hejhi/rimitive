/**
 * @fileoverview Resolve utility for creating selectors with dependencies
 *
 * Provides a clean way to create computed values from slices:
 * - Bind slice dependencies once
 * - Create selectors that compute values from those slices
 * - Type-safe with full inference
 * - Clear separation from slices (which have methods)
 */

/**
 * Create a selector factory with pre-configured slice dependencies.
 *
 * @param deps - Object mapping names to slice instances
 * @returns A selector factory function
 *
 * @example
 * ```typescript
 * const createSlice = createStore({ count: 0, multiplier: 2 });
 * 
 * const counter = createSlice(({ get }) => ({
 *   count: () => get().count
 * }));
 * 
 * const settings = createSlice(({ get }) => ({
 *   multiplier: () => get().multiplier
 * }));
 * 
 * // Create selector factory
 * const select = resolve({ counter, settings });
 * 
 * // Create computed values
 * const computed = select(({ counter, settings }) => ({
 *   total: counter.count() * settings.multiplier(),
 *   label: `Count: ${counter.count()} × ${settings.multiplier()}`
 * }));
 * 
 * // Create parameterized selectors
 * const createFilter = select(({ counter }) => (min: number, max: number) => ({
 *   inRange: counter.count() >= min && counter.count() <= max,
 *   value: counter.count()
 * }));
 * ```
 */
export function resolve<Deps extends Record<string, unknown>>(
  deps: Deps
): <Result>(
  selector: (resolvedDeps: Deps) => Result
) => Result {
  return function select<Result>(
    selector: (resolvedDeps: Deps) => Result
  ): Result {
    return selector(deps);
  };
}
