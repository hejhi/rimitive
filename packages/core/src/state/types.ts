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
 * Type for the state factory function
 */
export type StateFactory<T> = {
  get: GetState<T>;
  set: SetState<T>;
};

/**
 * Type for a state instance, which is a function that returns a slice creator
 * T represents the slice of state this state contributes
 */
export type StateInstance<T> = {
  (): SliceCreator<T>;
  __composition?: unknown;
  with<U>(
    factory: (tools: StateFactory<ComposedState<T, U>>) => U
  ): StateInstance<ComposedState<T, U>>;
  create(): FinalizedState<T>;
};

/**
 * Type for a finalized state, which can no longer be composed but is ready for use
 * This type represents the end of the composition phase
 */
export type FinalizedState<T> = {
  (): SliceCreator<T>;
  __finalized: true;
};

/**
 * Type for a slice creator function that Zustand will call
 */
export type SliceCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

/**
 * Utility type to extract the state type from a StateInstance
 */
export type StateState<T extends StateInstance<any>> =
  T extends StateInstance<infer S> ? S : never;

/**
 * Utility type for composing two state state types
 */
export type ComposedState<T, U> = T & U;

/**
 * Utility type for a composed state instance
 */
export type ComposedStateInstance<
  T extends StateInstance<any>,
  U extends StateInstance<any>,
> = StateInstance<ComposedState<StateState<T>, StateState<U>>>;
