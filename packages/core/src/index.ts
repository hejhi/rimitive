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

// Export resolve utility for bound computed views
export { resolve } from './resolve';

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export runtime
export {
  createLatticeStore,
  type StoreAdapter,
  type RuntimeResult,
} from './runtime';

// Type guards
export function isSliceFactory<Model = any, Slice = any>(
  value: unknown
): value is SliceFactory<Model, Slice> {
  return (
    typeof value === 'function' &&
    SLICE_FACTORY_MARKER in value &&
    value[SLICE_FACTORY_MARKER] === true
  );
}

// Export adapter test suite
// TODO: Update adapter test suite for new API
// export { createAdapterTestSuite } from './adapter-test-suite';

// New createStore API types
export interface StoreTools<State> {
  get: () => State;
  set: (updates: Partial<State>) => void;
}

export type StoreSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => Methods;

/**
 * Creates a store with pure serializable state and returns a slice factory.
 * This is the new primary API that separates state from behaviors.
 * 
 * @param initialState - The initial state (must be serializable)
 * @returns A factory function for creating slices with behaviors
 * 
 * @example
 * ```typescript
 * const createSlice = createStore({ count: 0, name: "John" });
 * 
 * const counter = createSlice(({ get, set }) => ({
 *   count: () => get().count,
 *   increment: () => set({ count: get().count + 1 })
 * }));
 * ```
 */
export function createStore<State>(
  initialState: State
): StoreSliceFactory<State> {
  // Create a mutable state container
  let state = { ...initialState };
  
  // Create tools that will be shared across all slices
  const tools: StoreTools<State> = {
    get: () => state,
    set: (updates: Partial<State>) => {
      state = { ...state, ...updates };
    }
  };
  
  // Return the slice factory function
  return function createSlice<Methods>(
    factory: (tools: StoreTools<State>) => Methods
  ): Methods {
    return factory(tools);
  };
}

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
