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

// Direct mapping from slice functions to their metadata
// This is much simpler and avoids the double-registry problem
const sliceMetadataRegistry = new WeakMap<SliceFunction, SliceMetadata>();
const compositionMetadataRegistry = new WeakMap<ComposedFunction, CompositionMetadata>();

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
  slice: SliceHandle<Computed>,
  metadata: SliceMetadata
): void {
  const sliceFunction = toSliceFunction(slice);
  sliceMetadataRegistry.set(sliceFunction, metadata);
}

/**
 * Retrieve metadata for a slice
 * Used by testing utilities and framework integrations
 */
export function getSliceMetadata<Computed>(
  slice: SliceHandle<Computed>
): SliceMetadata | undefined {
  const sliceFunction = toSliceFunction(slice);
  return sliceMetadataRegistry.get(sliceFunction);
}

/**
 * Store composition metadata for a function
 */
export function storeCompositionMetadata(
  fn: Function,
  metadata: CompositionMetadata
): void {
  const composedFunction = toComposedFunction(fn);
  compositionMetadataRegistry.set(composedFunction, metadata);
}

/**
 * Get composition metadata for a function
 */
export function getCompositionMetadata(
  fn: Function
): CompositionMetadata | undefined {
  const composedFunction = toComposedFunction(fn);
  return compositionMetadataRegistry.get(composedFunction);
}