/**
 * @fileoverview Shared adapter contract for Lattice framework
 *
 * This module defines the common interface that all Lattice adapters must implement.
 * Adapters are responsible for executing component specifications with real infrastructure.
 */

import type { ComponentFactory, ComponentSpec, SliceFactory } from './index';
import { SLICE_FACTORY_MARKER } from './index';

/**
 * View type helpers - transforms view definitions to their runtime signatures
 */
export type ViewTypes<Model, Views> = {
  [K in keyof Views]: Views[K] extends SliceFactory<Model, infer T>
    ? () => T // Static views become functions that return current state
    : Views[K] extends () => SliceFactory<Model, infer T>
      ? () => T // Computed views (no params) also become functions that return current state
      : Views[K] extends () => unknown
        ? Views[K] // Computed views (with or without params) - keep as-is
        : never;
};

/**
 * Subscription callback type
 */
type SubscribeCallback<T> = (value: T) => void;

/**
 * View subscription function type
 */
type ViewSubscribe<Views> = <Selected>(
  selector: (views: Views) => Selected,
  callback: SubscribeCallback<Selected>
) => () => void;

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
  /**
   * Subscribe to view changes
   * @example
   * const unsub = store.subscribe(
   *   views => ({ button: views.button(), count: views.counter() }),
   *   state => console.log('Views changed:', state)
   * );
   */
  subscribe: ViewSubscribe<ViewTypes<Model, Views>>;
  destroy: () => void;
  getState: () => Model;
}

/**
 * Extended adapter result with state access (for testing/debugging)
 * Note: Production adapters should NOT expose direct state access
 */
export interface TestAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
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
  component: ComponentFactory<Model, Actions, Views>
) => AdapterResult<Model, Actions, Views>;

/**
 * Test adapter factory function signature
 */
export type TestAdapterFactory = <Model, Actions, Views>(
  component:
    | ComponentSpec<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
) => TestAdapterResult<Model, Actions, Views>;

/**
 * Type guard to check if a value is a slice factory
 */
export function isSliceFactory<M, S>(
  value: unknown
): value is SliceFactory<M, S> {
  return (
    typeof value === 'function' &&
    SLICE_FACTORY_MARKER in value &&
    (value as Record<symbol, unknown>)[SLICE_FACTORY_MARKER] === true
  );
}
