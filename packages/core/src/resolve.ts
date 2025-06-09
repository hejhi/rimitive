/**
 * @fileoverview Select utility for creating bound computed view factories
 *
 * Provides a clean way to create multiple computed views with shared dependencies:
 * - Bind dependencies once to a model
 * - Create multiple parameterized views with those dependencies
 * - Each view is automatically memoized
 * - Type-safe with full inference
 */

import type { SliceFactory, ModelFactory } from './index';
import { createSlice } from './index';
import { compose } from './compose';
import { memoizeParameterizedView } from './utils/memoize';

/**
 * Type for resolved dependencies
 * Extract the slice result type from each SliceFactory in Deps
 */
type ResolveDeps<Deps> = {
  [K in keyof Deps]: Deps[K] extends SliceFactory<infer _Model, infer Slice>
    ? Slice
    : never;
};

/**
 * Validate that all dependencies have the same Model type as the provided model
 */
type ValidateDeps<Model, Deps> =
  Deps extends Record<string, SliceFactory<Model, any>> ? Deps : never;

/**
 * Create a bound compute function with pre-configured dependencies.
 *
 * This allows you to:
 * 1. Bind slices to a model once
 * 2. Create multiple computed views using those dependencies
 * 3. Each view gets automatic memoization
 *
 * @param model - The model factory that all dependencies must match
 * @param deps - Object mapping dependency names to SliceFactories
 * @returns A bound compute function for creating parameterized views
 *
 * @example
 * ```typescript
 * // First, bind slices to a model
 * const compute = resolve(model, {
 *   counter: counterSlice,
 *   stats: statsSlice
 * });
 *
 * // Then create parameterized computed views
 * export const multipliedCounter = compute(
 *   ({ counter }) => (multiplier: number) => ({
 *     value: counter.count() * multiplier,
 *     label: `×${multiplier}: ${counter.count()}`
 *   })
 * );
 *
 * // Can reuse the same compute for multiple views
 * export const summary = compute(
 *   ({ counter, stats }) => () => ({
 *     total: counter.count() + stats.total(),
 *     average: stats.average()
 *   })
 * );
 * ```
 */
export function resolve<
  Model,
  Deps extends Record<string, SliceFactory<Model, any>>,
>(
  model: ModelFactory<Model>,
  deps: ValidateDeps<Model, Deps>
): <Args extends readonly unknown[], Result>(
  factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
) => SliceFactory<Model, (...args: Args) => Result> {
  // Return the bound compute function
  return function boundCompute<Args extends readonly unknown[], Result>(
    factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
  ): SliceFactory<Model, (...args: Args) => Result> {
    // Use compose to resolve dependencies and create the parameterized view
    return createSlice(
      model,
      compose(deps, (_model, resolvedDeps) => {
        // Get the parameterized view function from the factory
        const parameterizedView = factory(resolvedDeps);

        // Return the memoized version
        return memoizeParameterizedView(parameterizedView);
      })
    );
  };
}
