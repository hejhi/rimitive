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
import type { StateFactory as SharedStateFactory } from '../shared/types';

/**
 * Type for the state factory function
 */
export type StateFactory<T> = SharedStateFactory<T>;

/**
 * Import Instance type from shared/types
 */
import type { Instance as SharedInstance } from '../shared/types';

/**
 * Type for a state instance, which is a function that returns a slice creator
 * T represents the slice of state this state contributes
 */
export type StateInstance<T> = SharedInstance<T, 'state'>;

/**
 * Import Finalized type from shared/types
 */
import type { Finalized as SharedFinalized } from '../shared/types';

/**
 * Type for a finalized state, which can no longer be composed but is ready for use
 * This type represents the end of the composition phase
 */
export type FinalizedState<T> = SharedFinalized<T>;

/**
 * Import SliceCreator from shared/types
 */
import type { SliceCreator as SharedSliceCreator } from '../shared/types';

/**
 * Type for a slice creator function that will be called with factory tools
 */
export type SliceCreator<T> = SharedSliceCreator<T>;

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
