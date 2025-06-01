// Slice-based Lattice Core API

// Core types
export interface ModelTools<T> {
  get: () => T;
  set: (updates: Partial<T>) => void;
}

export type ModelFactory<T = unknown> = (tools: ModelTools<T>) => T;
export interface SliceFactory<Model = unknown, Slice = unknown> {
  (model: Model): Slice;
  <T>(transform: (slice: Slice) => T): SliceFactory<Model, T>;
  [SLICE_FACTORY_MARKER]?: true;
}

// Implementation
export function createModel<T>(
  factory: (tools: ModelTools<T>) => T
): ModelFactory<T> {
  return factory;
}

export function createSlice<Model, Slice>(
  _model: ModelFactory<Model>,
  selector: (model: Model) => Slice
): SliceFactory<Model, Slice> {
  // Create a function that can both execute the selector and accept transforms
  const sliceFactory = function <T>(
    modelOrTransform: Model | ((slice: Slice) => T)
  ): Slice | SliceFactory<Model, T> {
    // Check if the argument is a transform function
    if (typeof modelOrTransform === 'function') {
      // Return a new SliceFactory that applies the transform
      const transform = modelOrTransform as (slice: Slice) => T;
      return createSlice(_model, (model: Model) => {
        const slice = selector(model);
        return transform(slice);
      });
    }

    // Otherwise, it's a model - execute the selector
    return selector(modelOrTransform);
  } as SliceFactory<Model, Slice>;

  // Brand the slice factory
  Object.defineProperty(sliceFactory, SLICE_FACTORY_MARKER, {
    value: true,
    enumerable: false,
    configurable: false,
  });

  return sliceFactory;
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

export function createComponent<Model, Actions, Views>(
  factory: () => ComponentSpec<Model, Actions, Views>
): ComponentFactory<Model, Actions, Views> {
  return factory;
}

// Export compose utilities
export { compose } from './compose';

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

// Type extraction helpers
export type ComponentModel<
  C extends ComponentFactory<unknown, unknown, unknown>,
> = C extends ComponentFactory<infer M, unknown, unknown> ? M : never;

export type ComponentActions<
  C extends ComponentFactory<unknown, unknown, unknown>,
> = C extends ComponentFactory<unknown, infer A, unknown> ? A : never;

export type ComponentViews<
  C extends ComponentFactory<unknown, unknown, unknown>,
> = C extends ComponentFactory<unknown, unknown, infer V> ? V : never;

export type ComponentType<C> = C extends ComponentFactory<infer M, infer A, infer V>
  ? {
      model: M;
      actions: A;
      views: V;
    }
  : never;

// In-source tests for slice transforms
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('SliceFactory should support transforms', () => {
    const model = createModel<{ count: number }>(() => ({ count: 5 }));
    const slice = createSlice(model, (m) => ({ value: m.count }));

    // Direct execution
    const result1 = slice({ count: 10 });
    expect(result1).toEqual({ value: 10 });

    // With transform
    const transformed = slice((s) => ({ doubled: s.value * 2 }));
    const result2 = transformed({ count: 10 });
    expect(result2).toEqual({ doubled: 20 });
  });

  it('Transformed slices should maintain type safety', () => {
    const model = createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 }));
    const pointSlice = createSlice(model, (m) => ({ x: m.x, y: m.y }));

    // Transform to distance
    const distanceSlice = pointSlice((p) => ({
      distance: Math.sqrt(p.x * p.x + p.y * p.y),
    }));

    const result = distanceSlice({ x: 3, y: 4 });
    expect(result).toEqual({ distance: 5 });
  });
}
