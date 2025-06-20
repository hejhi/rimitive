/**
 * Internal metadata storage for slices
 * This module is for framework integration and testing only
 */

import type { SliceHandle } from '../store';

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
  sliceMetadata: WeakMap<Function, SliceMetadata>;
  compositionMetadata: WeakMap<Function, CompositionMetadata>;
}

// Create a new metadata store for a store instance
export function createMetadataStore(): MetadataStore {
  return {
    sliceMetadata: new WeakMap<Function, SliceMetadata>(),
    compositionMetadata: new WeakMap<Function, CompositionMetadata>()
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
const globalSliceRegistry = new WeakMap<Function, symbol>();

/**
 * Store metadata for a slice (internal use only)
 */
export function storeSliceMetadata<Computed>(
  storeId: symbol,
  slice: SliceHandle<Computed>,
  metadata: SliceMetadata
): void {
  const store = getMetadataStore(storeId);
  store.sliceMetadata.set(slice as unknown as Function, metadata);
  // Also register globally for lookup
  globalSliceRegistry.set(slice as unknown as Function, storeId);
}

/**
 * Retrieve metadata for a slice
 * Used by testing utilities and framework integrations
 */
export function getSliceMetadata<Computed>(
  slice: SliceHandle<Computed>
): SliceMetadata | undefined {
  // Find which store this slice belongs to
  const storeId = globalSliceRegistry.get(slice as unknown as Function);
  if (!storeId) {
    return undefined;
  }
  
  // Get the metadata from the correct store
  const store = storeRegistry.get(storeId);
  if (!store) {
    return undefined;
  }
  
  return store.sliceMetadata.get(slice as unknown as Function);
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
  store.compositionMetadata.set(fn, metadata);
}

/**
 * Get composition metadata for a function
 */
export function getCompositionMetadata(
  storeId: symbol,
  fn: Function
): CompositionMetadata | undefined {
  const store = getMetadataStore(storeId);
  return store.compositionMetadata.get(fn);
}