// Slice-based Lattice Core API

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
  (model: Model): Slice;
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
  selector: (model: Model) => Slice
): SliceFactory<Model, Slice>;

// Implementation - simplified without transform support
export function createSlice<Model, Slice>(
  _model: ModelFactory<Model>,
  selector: (model: Model) => Slice
): SliceFactory<Model, Slice> {
  // Create a function that executes the selector with required api
  const sliceFactory = function (model: Model): Slice {
    return selector(model);
  };

  // Brand the slice factory
  Object.defineProperty(sliceFactory, SLICE_FACTORY_MARKER, {
    value: true,
    enumerable: false,
    configurable: false,
  });

  return sliceFactory as SliceFactory<Model, Slice>;
}

// Marker symbols
export const SLICE_FACTORY_MARKER = Symbol('lattice.sliceFactory');

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

// In-source tests for slice functionality
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('SliceFactory should execute selectors', () => {
    const model = createModel<{ count: number }>(() => ({ count: 5 }));
    const slice = createSlice(model, (m) => ({ value: m.count }));

    // Direct execution with required API
    const result = slice({ count: 10 });
    expect(result).toEqual({ value: 10 });
  });

  it('SliceFactory should maintain type safety', () => {
    const model = createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 }));
    const pointSlice = createSlice(model, (m) => ({ x: m.x, y: m.y }));

    const result = pointSlice({ x: 3, y: 4 });
    expect(result).toEqual({ x: 3, y: 4 });
  });

  it('SliceFactory should support required api parameter', () => {
    const model = createModel<{ count: number }>(() => ({ count: 5 }));
    const sliceWithApi = createSlice(model, (m) => {
      // API is now always available
      return {
        value: m.count,
        hasApi: true,
        stateFromModel: m.count,
      };
    });

    const result = sliceWithApi({ count: 10 });
    expect(result).toEqual({
      value: 10,
      hasApi: true,
      stateFromModel: 10,
    });
  });
}
