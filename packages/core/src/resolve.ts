/**
 * @fileoverview Resolve utility for creating computed views with dependencies
 *
 * Provides a clean way to create multiple computed views with shared dependencies:
 * - Bind dependencies once to a model
 * - Create multiple parameterized views with those dependencies
 * - Dependencies are resolved fresh on each view call
 * - Type-safe with full inference
 */

import type { SliceFactory } from './index';

/**
 * Infer the Model type from a record of slices (uses the first slice's model)
 */
type InferModel<Deps extends Record<string, SliceFactory<any, any>>> =
  Deps[keyof Deps] extends SliceFactory<infer M, any> ? M : never;

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
 * Ensure all slices in Deps have the same Model type
 */
type ValidateDeps<Deps extends Record<string, SliceFactory<any, any>>> = Deps &
  Record<string, SliceFactory<InferModel<Deps>, any>>;

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
 * 1. Bind slices together once
 * 2. Create multiple computed views using those dependencies
 * 3. Dependencies are resolved fresh on each view call
 *
 * @param deps - Object mapping dependency names to SliceFactories
 * @returns A bound compute function for creating parameterized views
 *
 * @example
 * ```typescript
 * // Bind slices together (model type is inferred from slices)
 * const compute = resolve({
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
export function resolve<Deps extends Record<string, SliceFactory<any, any>>>(
  deps: ValidateDeps<Deps>
): <Args extends readonly unknown[], Result>(
  factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
) => ViewFactory<InferModel<Deps>, Args, Result> {
  // Return the bound compute function
  return function boundCompute<Args extends readonly unknown[], Result>(
    factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
  ): ViewFactory<InferModel<Deps>, Args, Result> {
    // Return a function that takes getState and returns the view
    return (getState: () => InferModel<Deps>) => {
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
