/**
 * @fileoverview Compute utility for creating parameterized computed views
 *
 * Provides a clean way to create computed views that:
 * - Accept parameters
 * - Have explicit dependencies on other slices
 * - Are created once at store initialization
 * - Return memoized parameterized functions
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
 * Extract the Model type from a set of dependencies
 * All dependencies must have the same Model type
 */
type ExtractModel<Deps> = Deps extends Record<string, SliceFactory<infer M, any>> ? M : never;

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
  Deps extends Record<string, SliceFactory<any, unknown>>,
  Model extends ExtractModel<Deps> = ExtractModel<Deps>,
  Args extends readonly unknown[] = any[],
  Result = any
>(
  deps: Deps,
  factory: (resolvedDeps: ResolveDeps<Deps>) => (...args: Args) => Result
): SliceFactory<Model, (...args: Args) => Result> {
  // We need to infer the model type from the dependencies
  // Since all deps should have the same Model type, we can use any of them
  const depsArray = Object.values(deps);
  if (depsArray.length === 0) {
    // No dependencies - create a slice with a generic model
    // We need to create a dummy model factory to satisfy createSlice's type requirements
    const dummyModelFactory = (() => {}) as unknown as ModelFactory<Model>;
    return createSlice(
      dummyModelFactory,
      (_getModel: () => Model) => {
        const parameterizedView = factory({} as ResolveDeps<Deps>);
        return memoizeParameterizedView(parameterizedView);
      }
    );
  }

  // Create a dummy model factory that preserves the Model type
  // The actual model isn't used since compose handles dependency resolution
  const dummyModelFactory = (() => {}) as unknown as ModelFactory<Model>;
  
  // Use compose to resolve dependencies and create the parameterized view
  return createSlice(
    dummyModelFactory,
    compose(deps, (_model, resolvedDeps) => {
      // Get the parameterized view function from the factory
      const parameterizedView = factory(resolvedDeps);
      
      // Return the memoized version
      return memoizeParameterizedView(parameterizedView);
    })
  );
}