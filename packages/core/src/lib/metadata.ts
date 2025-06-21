/**
 * @fileoverview Internal metadata storage for slice composition and debugging
 * 
 * This uses WeakMaps to store metadata without polluting the actual objects,
 * ensuring clean APIs while maintaining framework capabilities.
 */

import type { SliceHandle } from '../runtime-types';

export interface SliceMetadata {
  dependencies: Set<string>;
  subscribe: (listener: () => void) => () => void;
}

export interface CompositionMetadata {
  slice: SliceHandle<unknown>;
  dependencies: Set<string>;
}

// WeakMaps for metadata storage
const sliceMetadata = new WeakMap<SliceHandle<any>, SliceMetadata>();
const compositionMetadata = new WeakMap<Function, CompositionMetadata>();

export function storeSliceMetadata(slice: SliceHandle<any>, metadata: SliceMetadata): void {
  sliceMetadata.set(slice, metadata);
  // Also store on the function for easier access
  (slice as any).__metadata__ = metadata;
}

export function getSliceMetadata(slice: SliceHandle<any>): SliceMetadata | undefined {
  return sliceMetadata.get(slice) || (slice as any).__metadata__;
}

export function storeCompositionMetadata(fn: Function, metadata: CompositionMetadata): void {
  compositionMetadata.set(fn, metadata);
}

export function getCompositionMetadata(fn: Function): CompositionMetadata | undefined {
  return compositionMetadata.get(fn);
}