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
 * Import shared factory type
 */
import type { ModelFactory as SharedModelFactory } from '../shared/types';

/**
 * Type for the model factory function
 */
export type ModelFactory<T> = SharedModelFactory<T>;

/**
 * Import Instance type from shared/types
 */
import type { Instance as SharedInstance } from '../shared/types';

/**
 * Type for a model instance, which is a function that returns a slice creator
 * T represents the slice of state this model contributes
 */
export type ModelInstance<T> = SharedInstance<T, 'model'>;

/**
 * Import Finalized type from shared/types
 */
import type { Finalized as SharedFinalized } from '../shared/types';

/**
 * Type for a finalized model, which can no longer be composed but is ready for use
 * This type represents the end of the composition phase
 */
export type FinalizedModel<T> = SharedFinalized<T>;

/**
 * Import SliceCreator from shared/types
 */
import type { SliceCreator as SharedSliceCreator } from '../shared/types';

/**
 * Type for a slice creator function that will be called with factory tools
 */
export type SliceCreator<T> = SharedSliceCreator<T>;

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
