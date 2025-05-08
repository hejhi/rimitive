/**
 * Import Zustand types for better type safety
 */
import type { StoreApi } from 'zustand';

/**
 * Type for the Zustand get function - extracts the state type from a store
 */
export type GetState<T> = StoreApi<T>['getState'];

/**
 * Type for the Zustand set function - extracts the setState type from a store
 */
export type SetState<T> = StoreApi<T>['setState'];

/**
 * Type for the model factory function
 */
export type ModelFactory<T> = {
  get: GetState<T>;
  set: SetState<T>;
};

/**
 * Type for a model instance, which is a function that returns a slice creator
 * T represents the slice of state this model contributes
 */
export type ModelInstance<T> = {
  (): SliceCreator<T>;
  __composition?: unknown;
  with<U>(
    factory: (tools: ModelFactory<ComposedState<T, U>>) => U
  ): ModelInstance<ComposedState<T, U>>;
  create(): FinalizedModel<T>;
};

/**
 * Type for a finalized model, which can no longer be composed but is ready for use
 * This type represents the end of the composition phase
 */
export type FinalizedModel<T> = {
  (): SliceCreator<T>;
  __finalized: true;
};

/**
 * Type for a slice creator function that Zustand will call
 */
export type SliceCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

/**
 * Utility type to extract the state type from a ModelInstance
 */
export type ModelState<T extends ModelInstance<any>> =
  T extends ModelInstance<infer S> ? S : never;

/**
 * Utility type for composing two model state types
 */
export type ComposedState<T, U> = T & U;

/**
 * Utility type for a composed model instance
 */
export type ComposedModelInstance<
  T extends ModelInstance<any>,
  U extends ModelInstance<any>,
> = ModelInstance<ComposedState<ModelState<T>, ModelState<U>>>;
