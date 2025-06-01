/**
 * @fileoverview Shared adapter contract for Lattice framework
 * 
 * This module defines the common interface that all Lattice adapters must implement.
 * Adapters are responsible for executing component specifications with real infrastructure.
 */

import type { ComponentSpec, SliceFactory } from './index';

/**
 * View type helpers - transforms view definitions to their runtime signatures
 */
export type ViewTypes<Model, Views> = {
  [K in keyof Views]: Views[K] extends SliceFactory<Model, infer T>
    ? () => T  // Static views become functions that return current state
    : Views[K] extends () => SliceFactory<Model, infer T>
    ? () => T  // Computed views also become functions that return current state
    : Views[K] extends () => unknown
    ? Views[K]  // Already a function, keep as-is
    : never;
};

/**
 * Core adapter result that all adapters must provide
 * 
 * @template Model - The model type from the component
 * @template Actions - The actions type from the component
 * @template Views - The views type from the component
 */
export interface AdapterResult<Model, Actions, Views> {
  /**
   * Actions object containing all action methods
   * These are directly callable without any additional wrapping
   */
  actions: Actions;

  /**
   * Views object where each view is a function that returns current attributes
   * - Static views: () => attributes based on current state
   * - Computed views: () => computed attributes based on current state
   */
  views: ViewTypes<Model, Views>;
}

/**
 * Extended adapter result with state access (for testing/debugging)
 * Note: Production adapters should NOT expose direct state access
 */
export interface TestAdapterResult<Model, Actions, Views> extends AdapterResult<Model, Actions, Views> {
  /**
   * Get the current model state (for testing only)
   */
  getState: () => Model;

  /**
   * Execute a slice factory with current state (for testing only)
   */
  getSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
}

/**
 * Adapter factory function signature
 * 
 * All adapters should export a function with this signature
 */
export type AdapterFactory = <Model, Actions, Views>(
  component: ComponentSpec<Model, Actions, Views> | (() => ComponentSpec<Model, Actions, Views>)
) => AdapterResult<Model, Actions, Views>;

/**
 * Test adapter factory function signature
 */
export type TestAdapterFactory = <Model, Actions, Views>(
  component: ComponentSpec<Model, Actions, Views> | (() => ComponentSpec<Model, Actions, Views>)
) => TestAdapterResult<Model, Actions, Views>;

/**
 * Type guard to check if a value is a slice factory
 */
export function isSliceFactory<M, S>(value: unknown): value is SliceFactory<M, S> {
  return typeof value === 'function' && 
    (value as any)[Symbol.for('lattice.sliceFactory')] === true;
}

/**
 * Type guard to check if a value is a computed view (function returning slice factory)
 */
export function isComputedView<M, S>(value: unknown): value is () => SliceFactory<M, S> {
  if (typeof value !== 'function') return false;
  
  // Try to call it and see if it returns a slice factory
  // This is a bit risky but necessary for runtime type checking
  try {
    const result = (value as () => unknown)();
    return isSliceFactory(result);
  } catch {
    // If it throws, it might need parameters, so it's not a computed view
    return false;
  }
}