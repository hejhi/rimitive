/**
 * Import Zustand types for better type safety
 */
import type { StoreApi } from 'zustand';

/**
 * Type for the Zustand get function - extracts the state type from a store
 */
export type GetState<T = any> = StoreApi<T>['getState'];

/**
 * Type for the Zustand set function - extracts the setState type from a store
 */
export type SetState<T = any> = StoreApi<T>['setState'];

/**
 * Type for the model factory function
 */
export type ModelFactory<T = any> = {
  get: GetState<T>;
  set: SetState<T>;
};

/**
 * Type for a model instance, which is a function that returns a slice creator
 */
export type ModelInstance<T = any> = () => SliceCreator<T>;

/**
 * Type for a slice creator function that Zustand will call
 */
export type SliceCreator<T = any> = (set: SetState<T>, get: GetState<T>) => T;
