/**
 * @fileoverview Compose utility for createSlice dependency injection
 *
 * Provides a clean way to compose slices with explicit dependencies.
 *
 * This implementation uses a purely functional approach with multiple
 * function layers to encode composition data.
 */

import type { SliceFactory } from './index';

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
 * Compose function for dependency injection in createSlice
 */
export function compose<
  Model,
  Deps extends Record<string, SliceFactory<Model, unknown>>,
  Result,
>(
  deps: Deps,
  selector: (model: Model, resolvedDeps: ResolveDeps<Deps>) => Result
): (getModel: () => Model) => Result {
  // Return a selector function that resolves dependencies and accepts required api parameter
  return (getModel: () => Model): Result => {
    // Build resolved dependencies using Object.fromEntries for type safety
    // Pass both model and api to each dependency slice
    const entries = Object.entries(deps).map(([key, sliceFactory]) => [
      key,
      sliceFactory(getModel),
    ]);
    const resolvedDeps = Object.fromEntries(entries) as ResolveDeps<Deps>;

    // Call the selector with model and resolved dependencies
    return selector(getModel(), resolvedDeps);
  };
}
