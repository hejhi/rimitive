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
export const SELECT_MARKER = Symbol('lattice.select');
export const SLICE_FACTORY_MARKER = Symbol('lattice.sliceFactory');

// Select marker value type
export interface SelectMarkerValue<Model, T, U = T> {
  slice: SliceFactory<Model, T>;
  selector?: (value: T) => U;
}

// Note: The select() function must return a type-cast value because it returns
// a marker object that pretends to be type T (or U if selector is provided).
// This is by design - adapters recognize and handle these markers specially.
export function select<Model, T, U = T>(
  slice: SliceFactory<Model, T>,
  selector?: (value: T) => U
): U {
  // Create marker object with proper type
  const marker = Object.create(null);

  // Store both slice and optional selector under SELECT_MARKER
  const markerValue: SelectMarkerValue<Model, T, U> = {
    slice,
    ...(selector !== undefined && { selector }),
  };

  marker[SELECT_MARKER] = markerValue;

  // This cast is intentional and required for the marker pattern to work
  return marker as U;
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

export function createComponent<Model, Actions, Views>(
  factory: () => ComponentSpec<Model, Actions, Views>
): ComponentFactory<Model, Actions, Views> {
  return factory;
}

// Export compose utilities
export { compose, composeSlices } from './compose';

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

export type ComponentType<
  C extends ComponentFactory<unknown, unknown, unknown>,
> = {
  model: ComponentModel<C>;
  actions: ComponentActions<C>;
  views: ComponentViews<C>;
};

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

  it('select() should create proper markers', () => {
    const model = createModel<{ value: string }>(() => ({ value: 'test' }));
    const slice = createSlice(model, (m) => ({ val: m.value }));

    const marker = select(slice);
    expect(SELECT_MARKER in marker).toBe(true);
    const markerValue = (marker as Record<symbol, unknown>)[
      SELECT_MARKER
    ] as SelectMarkerValue<unknown, unknown>;
    expect(markerValue.slice).toBe(slice);
    expect(markerValue.selector).toBeUndefined();
  });

  it('select() should support selector parameter', () => {
    const model = createModel<{ count: number; name: string }>(() => ({
      count: 5,
      name: 'test',
    }));
    const slice = createSlice(model, (m) => ({ count: m.count, name: m.name }));

    // Without selector - returns full slice result type
    const fullMarker = select(slice);
    expect(SELECT_MARKER in fullMarker).toBe(true);
    const fullMarkerValue = (fullMarker as Record<symbol, unknown>)[
      SELECT_MARKER
    ] as SelectMarkerValue<unknown, unknown>;
    expect(fullMarkerValue.slice).toBe(slice);
    expect(fullMarkerValue.selector).toBeUndefined();

    // With selector - returns selector result type
    const countMarker = select(slice, (s) => s.count);
    // Since countMarker is typed as number, we need to check it as an object
    const countMarkerObj = countMarker as unknown as Record<symbol, unknown>;
    expect(SELECT_MARKER in countMarkerObj).toBe(true);
    const countMarkerValue = countMarkerObj[SELECT_MARKER] as SelectMarkerValue<
      unknown,
      { count: number; name: string },
      number
    >;
    expect(countMarkerValue.slice).toBe(slice);
    expect(typeof countMarkerValue.selector).toBe('function');

    // Verify selector function is stored correctly
    const selectorFn = countMarkerValue.selector!;
    expect(selectorFn({ count: 10, name: 'test' })).toBe(10);
  });

  it('select() with selector should maintain type safety', () => {
    const model = createModel<{ x: number; y: number; z: number }>(() => ({
      x: 1,
      y: 2,
      z: 3,
    }));
    const vectorSlice = createSlice(model, (m) => ({ x: m.x, y: m.y, z: m.z }));

    // Select only x and y coordinates
    const xyMarker = select(vectorSlice, (v) => ({ x: v.x, y: v.y }));

    // Type should be inferred as { x: number; y: number }
    // This test verifies the marker is created correctly
    expect(SELECT_MARKER in xyMarker).toBe(true);

    const markerValue = (xyMarker as Record<symbol, unknown>)[
      SELECT_MARKER
    ] as SelectMarkerValue<
      unknown,
      { x: number; y: number; z: number },
      { x: number; y: number }
    >;
    expect(markerValue.slice).toBe(vectorSlice);
    expect(typeof markerValue.selector).toBe('function');

    const result = markerValue.selector!({ x: 10, y: 20, z: 30 });
    expect(result).toEqual({ x: 10, y: 20 });
    expect('z' in result).toBe(false);
  });

  it('select() usage example in slice composition', () => {
    // Example showing practical usage of select with selector
    const model = createModel<{
      user: { id: number; name: string; email: string };
      posts: Array<{ id: number; title: string; authorId: number }>;
    }>(() => ({
      user: { id: 1, name: 'Alice', email: 'alice@example.com' },
      posts: [
        { id: 1, title: 'First Post', authorId: 1 },
        { id: 2, title: 'Second Post', authorId: 1 },
      ],
    }));

    const userSlice = createSlice(model, (m) => m.user);
    const postsSlice = createSlice(model, (m) => m.posts);

    // Create a composite slice that uses select with selectors
    const profileSlice = createSlice(model, () => ({
      // Select only name from user slice
      userName: select(userSlice, (u) => u.name),
      // Select only post count from posts slice
      postCount: select(postsSlice, (p) => p.length),
      // Select full user object (no selector)
      fullUser: select(userSlice),
    }));

    // Verify the markers are created correctly
    const profileMarkers = profileSlice(null as never);

    // userName should be a string marker
    const userNameMarker = profileMarkers.userName as unknown as Record<
      symbol,
      unknown
    >;
    expect(SELECT_MARKER in userNameMarker).toBe(true);
    const userNameMarkerValue = userNameMarker[
      SELECT_MARKER
    ] as SelectMarkerValue<unknown, unknown>;
    expect(userNameMarkerValue.slice).toBe(userSlice);
    expect(typeof userNameMarkerValue.selector).toBe('function');

    // postCount should be a number marker
    const postCountMarker = profileMarkers.postCount as unknown as Record<
      symbol,
      unknown
    >;
    expect(SELECT_MARKER in postCountMarker).toBe(true);
    const postCountMarkerValue = postCountMarker[
      SELECT_MARKER
    ] as SelectMarkerValue<unknown, unknown>;
    expect(postCountMarkerValue.slice).toBe(postsSlice);
    expect(typeof postCountMarkerValue.selector).toBe('function');

    // fullUser should be a user object marker without selector
    const fullUserMarker = profileMarkers.fullUser as unknown as Record<
      symbol,
      unknown
    >;
    expect(SELECT_MARKER in fullUserMarker).toBe(true);
    const fullUserMarkerValue = fullUserMarker[
      SELECT_MARKER
    ] as SelectMarkerValue<unknown, unknown>;
    expect(fullUserMarkerValue.slice).toBe(userSlice);
    expect(fullUserMarkerValue.selector).toBeUndefined();
  });
}
