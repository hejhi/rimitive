// Slice-based Lattice Core API

// Core types
export interface ModelTools<T = any> {
  get: () => T;
  set: (updates: Partial<T>) => void;
}

export type ModelFactory<T = any> = (tools: ModelTools<T>) => T;
export type SliceFactory<Model = any, Slice = any> = (model: Model) => Slice;

// Implementation
export function createModel<T>(factory: (tools: ModelTools<T>) => T): ModelFactory<T> {
  return factory;
}

export function createSlice<Model, Slice>(
  _model: ModelFactory<Model>,
  selector: (model: Model) => Slice
): SliceFactory<Model, Slice> {
  return selector;
}

// Marker symbol for select
const SELECT_MARKER = Symbol('lattice.select');

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