/**
 * @fileoverview Compute utility for creating parameterized computed views
 *
 * Provides a clean way to create computed views that:
 * - Accept parameters
 * - Have explicit dependencies on other slices
 * - Are created once at store initialization
 * - Return memoized parameterized functions
 */

import type { SliceFactory } from './index';
import { createSlice, createModel } from './index';
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
 * Create a parameterized computed view with dependencies.
 * 
 * Returns a single SliceFactory that:
 * - Executes once when the store is created
 * - Resolves dependencies once
 * - Returns a memoized parameterized function
 * 
 * @param deps - Object mapping dependency names to SliceFactories
 * @param factory - Function that receives resolved deps and returns a parameterized view function
 * @returns A SliceFactory that produces the parameterized view function
 * 
 * @example
 * ```typescript
 * const multipliedCounter = compute(
 *   { counter: counterSlice },
 *   ({ counter }) => (multiplier: number) => ({
 *     value: counter.count() * multiplier,
 *     label: `×${multiplier}: ${counter.count()}`
 *   })
 * );
 * 
 * // In component:
 * const views = {
 *   multiplied: multipliedCounter  // Single SliceFactory
 * };
 * 
 * // Usage:
 * const view = store.views.multiplied();  // Get the parameterized function
 * const doubled = view(2);  // Apply parameters
 * ```
 */
export function compute<
  Model,
  Deps extends Record<string, SliceFactory<Model, unknown>>,
  Args extends readonly unknown[],
  Result
>(
  deps: Deps,
  factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
): SliceFactory<Model, (...args: Args) => Result> {
  // We need to infer the model type from the dependencies
  // Since all deps should have the same Model type, we can use any of them
  const depsArray = Object.values(deps);
  if (depsArray.length === 0) {
    // No dependencies - create a slice with an empty model
    return createSlice(
      createModel(() => ({} as Model)),
      compose({}, (_model, _resolvedDeps) => {
        const parameterizedView = factory({} as ResolveDeps<Deps>);
        return memoizeParameterizedView(parameterizedView);
      })
    );
  }

  // Use compose to resolve dependencies and create the parameterized view
  return createSlice(
    {} as any, // The model is not used directly since compose handles dependency resolution
    compose(deps, (_model, resolvedDeps) => {
      // Get the parameterized view function from the factory
      const parameterizedView = factory(resolvedDeps);
      
      // Return the memoized version
      return memoizeParameterizedView(parameterizedView);
    })
  );
}