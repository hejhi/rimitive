/**
 * @fileoverview Resolve utility for creating computed views with dependencies
 *
 * Provides a clean way to create multiple computed views with shared dependencies:
 * - Bind dependencies once to a model
 * - Create multiple parameterized views with those dependencies
 * - Dependencies are resolved fresh on each view call
 * - Type-safe with full inference
 */

import type { SliceFactory, ModelFactory } from './index';

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
 * Type for a view factory that takes a getState function
 */
type ViewFactory<Model, Args extends readonly unknown[], Result> = (
  getState: () => Model
) => (...args: Args) => Result;

/**
 * Create a bound compute function with pre-configured dependencies.
 *
 * This allows you to:
 * 1. Bind slices to a model once
 * 2. Create multiple computed views using those dependencies
 * 3. Dependencies are resolved fresh on each view call
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
 * // Use with an adapter
 * const view = multipliedCounter(() => adapter.getState());
 * const doubled = view(2); // { value: 20, label: '×2: 10' }
 * ```
 */
export function resolve<
  Model,
  Deps extends Record<string, SliceFactory<Model, any>>,
>(
  _model: ModelFactory<Model>,
  deps: ValidateDeps<Model, Deps>
): <Args extends readonly unknown[], Result>(
  factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
) => ViewFactory<Model, Args, Result> {
  // Return the bound compute function
  return function boundCompute<Args extends readonly unknown[], Result>(
    factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
  ): ViewFactory<Model, Args, Result> {
    // Return a function that takes getState and returns the view
    return (getState: () => Model) => {
      // Execute slices once to get the getter objects
      const resolvedDeps = {} as ResolveDeps<Deps>;
      for (const [key, sliceFactory] of Object.entries(deps)) {
        resolvedDeps[key as keyof Deps] = sliceFactory(getState) as any;
      }

      // Create the view function with resolved dependencies
      const viewFn = factory(resolvedDeps);

      // Return the view function
      return viewFn;
    };
  };
}
