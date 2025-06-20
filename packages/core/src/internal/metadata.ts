/**
 * Internal metadata storage for slices
 * This module is for framework integration and testing only
 */

import type { SliceHandle } from '../store';

// Brand type for type-safe slice functions
const SliceFunctionBrand = Symbol('SliceFunction');
type SliceFunction = Function & { [SliceFunctionBrand]?: true };

// Brand type for composed value functions  
const ComposedFunctionBrand = Symbol('ComposedFunction');
type ComposedFunction = Function & { [ComposedFunctionBrand]?: true };

export interface SliceMetadata {
  dependencies: Set<string>;
  subscribe: (listener: () => void) => () => void;
}

export interface CompositionMetadata {
  slice: SliceHandle<unknown>;
  dependencies: Set<string>;
}

// Store metadata scoped to each store instance
export interface MetadataStore {
  sliceMetadata: WeakMap<SliceFunction, SliceMetadata>;
  compositionMetadata: WeakMap<ComposedFunction, CompositionMetadata>;
}

// Create a new metadata store for a store instance
export function createMetadataStore(): MetadataStore {
  return {
    sliceMetadata: new WeakMap<SliceFunction, SliceMetadata>(),
    compositionMetadata: new WeakMap<ComposedFunction, CompositionMetadata>()
  };
}

// Global registry mapping store IDs to their metadata stores
const storeRegistry = new WeakMap<symbol, MetadataStore>();

/**
 * Register a metadata store for a store instance
 */
export function registerStore(storeId: symbol): void {
  storeRegistry.set(storeId, createMetadataStore());
}

/**
 * Get the metadata store for a store instance
 */
function getMetadataStore(storeId: symbol): MetadataStore {
  const store = storeRegistry.get(storeId);
  if (!store) {
    throw new Error('Store not registered. This is an internal error.');
  }
  return store;
}

// Keep track of all slices globally for lookup
// This allows getSliceMetadata to work without knowing the store ID
const globalSliceRegistry = new WeakMap<SliceFunction, symbol>();

/**
 * Type guard to check if a value is a function
 */
function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Safely cast a SliceHandle to SliceFunction for WeakMap storage
 */
function toSliceFunction<T>(slice: SliceHandle<T>): SliceFunction {
  if (!isFunction(slice)) {
    throw new Error('Invalid slice: must be a function');
  }
  return slice as SliceFunction;
}

/**
 * Safely cast a function to ComposedFunction for WeakMap storage
 */
function toComposedFunction(fn: Function): ComposedFunction {
  return fn as ComposedFunction;
}

/**
 * Store metadata for a slice (internal use only)
 */
export function storeSliceMetadata<Computed>(
  storeId: symbol,
  slice: SliceHandle<Computed>,
  metadata: SliceMetadata
): void {
  const store = getMetadataStore(storeId);
  const sliceFunction = toSliceFunction(slice);
  store.sliceMetadata.set(sliceFunction, metadata);
  // Also register globally for lookup
  globalSliceRegistry.set(sliceFunction, storeId);
}

/**
 * Retrieve metadata for a slice
 * Used by testing utilities and framework integrations
 */
export function getSliceMetadata<Computed>(
  slice: SliceHandle<Computed>
): SliceMetadata | undefined {
  // Find which store this slice belongs to
  const sliceFunction = toSliceFunction(slice);
  const storeId = globalSliceRegistry.get(sliceFunction);
  if (!storeId) {
    return undefined;
  }
  
  // Get the metadata from the correct store
  const store = storeRegistry.get(storeId);
  if (!store) {
    return undefined;
  }
  
  return store.sliceMetadata.get(sliceFunction);
}

/**
 * Store composition metadata for a function
 */
export function storeCompositionMetadata(
  storeId: symbol,
  fn: Function,
  metadata: CompositionMetadata
): void {
  const store = getMetadataStore(storeId);
  const composedFunction = toComposedFunction(fn);
  store.compositionMetadata.set(composedFunction, metadata);
}

/**
 * Get composition metadata for a function
 */
export function getCompositionMetadata(
  storeId: symbol,
  fn: Function
): CompositionMetadata | undefined {
  const store = getMetadataStore(storeId);
  const composedFunction = toComposedFunction(fn);
  return store.compositionMetadata.get(composedFunction);
}