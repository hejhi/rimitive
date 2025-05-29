// Slice-based Lattice Core API

// Core types
export interface ModelTools<T = any> {
  get: () => T;
  set: (updates: Partial<T>) => void;
}

export type ModelFactory<T = any> = (tools: ModelTools<T>) => T;
export interface SliceFactory<Model = any, Slice = any> {
  (model: Model): Slice;
  <T>(transform: (slice: Slice) => T): SliceFactory<Model, T>;
  [SLICE_FACTORY_MARKER]?: true;
}

// Implementation
export function createModel<T>(factory: (tools: ModelTools<T>) => T): ModelFactory<T> {
  return factory;
}

export function createSlice<Model, Slice>(
  _model: ModelFactory<Model>,
  selector: (model: Model) => Slice
): SliceFactory<Model, Slice> {
  // Create a function that can both execute the selector and accept transforms
  const sliceFactory = function sliceFactory(modelOrTransform: Model | ((slice: Slice) => any)) {
    // Check if the argument is a transform function
    if (typeof modelOrTransform === 'function') {
      // Return a new SliceFactory that applies the transform
      const transform = modelOrTransform as (slice: Slice) => any;
      return createSlice(_model, (model: Model) => {
        const slice = selector(model);
        return transform(slice);
      });
    }
    
    // Otherwise, it's a model - execute the selector
    return selector(modelOrTransform as Model);
  } as SliceFactory<Model, Slice>;
  
  // Brand the slice factory
  sliceFactory[SLICE_FACTORY_MARKER] = true;
  
  return sliceFactory;
}

// Marker symbols
export const SELECT_MARKER = Symbol('lattice.select');
export const SLICE_FACTORY_MARKER = Symbol('lattice.sliceFactory');

export function select<Model, T>(slice: SliceFactory<Model, T>): T {
  // Return a marker that adapters can recognize
  // This allows slices to compose other slices
  // The cast is necessary because we're returning a marker object
  // that will be interpreted by adapters, not the actual type T
  return {
    [SELECT_MARKER]: slice
  } as T;
}

export interface ComponentSpec<Model = any, Actions = any, Views = any> {
  model: ModelFactory<Model>;
  actions: SliceFactory<Model, Actions>;
  views: Views;
}

export type ComponentFactory<Model = any, Actions = any, Views = any> = 
  () => ComponentSpec<Model, Actions, Views>;

export function createComponent<Model, Actions, Views>(
  factory: () => ComponentSpec<Model, Actions, Views>
): ComponentFactory<Model, Actions, Views> {
  return factory;
}


// In-source tests for slice transforms
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('SliceFactory should support transforms', () => {
    const model = createModel<{ count: number }>(() => ({ count: 5 }));
    const slice = createSlice(model, m => ({ value: m.count }));
    
    // Direct execution
    const result1 = slice({ count: 10 });
    expect(result1).toEqual({ value: 10 });
    
    // With transform
    const transformed = slice(s => ({ doubled: s.value * 2 }));
    const result2 = transformed({ count: 10 });
    expect(result2).toEqual({ doubled: 20 });
  });

  it('Transformed slices should maintain type safety', () => {
    const model = createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 }));
    const pointSlice = createSlice(model, m => ({ x: m.x, y: m.y }));
    
    // Transform to distance
    const distanceSlice = pointSlice(p => ({
      distance: Math.sqrt(p.x * p.x + p.y * p.y)
    }));
    
    const result = distanceSlice({ x: 3, y: 4 });
    expect(result).toEqual({ distance: 5 });
  });

  it('select() should create proper markers', () => {
    const model = createModel<{ value: string }>(() => ({ value: 'test' }));
    const slice = createSlice(model, m => ({ val: m.value }));
    
    const marker = select(slice);
    expect(SELECT_MARKER in marker).toBe(true);
    expect((marker as any)[SELECT_MARKER]).toBe(slice);
  });
}