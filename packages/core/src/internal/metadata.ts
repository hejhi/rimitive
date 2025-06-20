/**
 * Internal metadata storage for slices
 * This module is for framework integration and testing only
 */

import type { SliceHandle } from '../store';

export interface SliceMetadata {
  dependencies: Set<string>;
  subscribe: (listener: () => void) => () => void;
}

// Module-scoped storage for all slice metadata
const sliceMetadataStore = new WeakMap<Function, SliceMetadata>();

/**
 * Store metadata for a slice (internal use only)
 */
export function storeSliceMetadata<Computed>(
  slice: SliceHandle<Computed>,
  metadata: SliceMetadata
): void {
  sliceMetadataStore.set(slice as unknown as Function, metadata);
}

/**
 * Retrieve metadata for a slice
 * Used by testing utilities and framework integrations
 */
export function getSliceMetadata<Computed>(
  slice: SliceHandle<Computed>
): SliceMetadata | undefined {
  return sliceMetadataStore.get(slice as unknown as Function);
}

// Store for composition metadata
const compositionMetadataStore = new WeakMap<Function, { slice: SliceHandle<unknown>; dependencies: Set<string> }>();

/**
 * Store composition metadata for a function
 */
export function storeCompositionMetadata(
  fn: Function,
  metadata: { slice: SliceHandle<unknown>; dependencies: Set<string> }
): void {
  compositionMetadataStore.set(fn, metadata);
}

/**
 * Get composition metadata for a function
 */
export function getCompositionMetadata(
  fn: Function
): { slice: SliceHandle<unknown>; dependencies: Set<string> } | undefined {
  return compositionMetadataStore.get(fn);
}