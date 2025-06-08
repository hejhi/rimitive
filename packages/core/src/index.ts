// Slice-based Lattice Core API

// Marker symbols - defined first to avoid forward reference issues
export const SLICE_FACTORY_MARKER = Symbol('lattice.sliceFactory');

// Core types
export interface ModelTools<T> {
  get: () => T;
  set: (updates: Partial<T>) => void;
}

/**
 * Base API interface that all adapters must provide to slices.
 * Adapters should NOT extend this interface with adapter-specific functionality
 * to maintain component portability across adapters.
 *
 * @template Model - The model type for type-safe state access
 */
export interface AdapterAPI<Model> {
  /**
   * Execute any slice factory and get its result.
   * This allows slices to compose and call other slices dynamically.
   *
   * @param slice - The slice factory to execute
   * @returns The result of executing the slice with current state
   */
  executeSlice<T>(slice: SliceFactory<Model, T>): T;
  /**
   * Get the current underlying model state.
   *
   * @returns The current state of the model
   */
  getState(): Model;
}

export type ModelFactory<T = unknown> = (tools: ModelTools<T>) => T;

/**
 * A factory function that creates slices from the model state.
 * Requires AdapterAPI parameter for slice execution.
 *
 * @template Model - The model type
 * @template Slice - The slice return type
 */

export interface SliceFactory<Model = unknown, Slice = unknown> {
  (getModel: () => Model): Slice;
  [SLICE_FACTORY_MARKER]?: true;
}

// Implementation
export function createModel<T>(
  factory: (tools: ModelTools<T>) => T
): ModelFactory<T> {
  return factory;
}

// Overload for regular selectors (preserves inference)
export function createSlice<Model, Slice>(
  _model: ModelFactory<Model>,
  selector: (getModel: () => Model) => Slice
): SliceFactory<Model, Slice>;

// Implementation - simplified without transform support
export function createSlice<Model, Slice>(
  _model: ModelFactory<Model>,
  selector: (getModel: () => Model) => Slice
): SliceFactory<Model, Slice> {
  // Cache results per execution context
  const cache = new WeakMap<() => Model, Slice>();

  // Create a function that executes the selector with required api
  const sliceFactory = function (getModel: () => Model): Slice {
    // Check if we have a cached result for this context
    if (cache.has(getModel)) {
      return cache.get(getModel)!;
    }

    // Execute the selector and cache the result
    const result = selector(getModel);
    cache.set(getModel, result);
    return result;
  };

  // Brand the slice factory
  Object.defineProperty(sliceFactory, SLICE_FACTORY_MARKER, {
    value: true,
    enumerable: false,
    configurable: false,
  });

  return sliceFactory as SliceFactory<Model, Slice>;
}

export interface ComponentSpec<Model, Actions, Views> {
  model: ModelFactory<Model>;
  actions: SliceFactory<Model, Actions>;
  views: Views;
}

export type ComponentFactory<Model, Actions, Views> = () => ComponentSpec<
  Model,
  Actions,
  Views
>;

// Export compose utilities
export { compose } from './compose';

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export adapter contract types
export type {
  AdapterResult,
  TestAdapterResult,
  AdapterFactory,
  TestAdapterFactory,
  ViewTypes,
} from './adapter-contract';

export { isSliceFactory } from './adapter-contract';

// Export adapter test suite
export { createAdapterTestSuite } from './adapter-test-suite';

// Type extraction helpers - using ReturnType to bypass variance checks
export type ComponentModel<C> = C extends (...args: unknown[]) => infer R
  ? R extends ComponentSpec<infer M, unknown, unknown>
    ? M
    : never
  : never;

export type ComponentActions<C> = C extends (...args: unknown[]) => infer R
  ? R extends ComponentSpec<unknown, infer A, unknown>
    ? A
    : never
  : never;

export type ComponentViews<C> = C extends (...args: unknown[]) => infer R
  ? R extends ComponentSpec<unknown, unknown, infer V>
    ? V
    : never
  : never;

export type ComponentType<C> = C extends (...args: unknown[]) => infer R
  ? R extends ComponentSpec<infer M, infer A, infer V>
    ? {
        model: M;
        actions: A;
        views: V;
      }
    : never
  : never;
