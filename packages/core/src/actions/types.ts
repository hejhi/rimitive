/**
 * Re-export shared types
 */
import type { 
  Factory as GenericFactory,
  ActionsFactory as SharedActionsFactory,
  SliceCreator,
  MutateFunction,
} from '../shared/types';

/**
 * Export the MutateFunction for actions
 */
export type Mutate<T> = MutateFunction;

/**
 * Re-export the Factory type
 */
export type Factory<T> = GenericFactory<T>;

/**
 * Re-export the ActionsFactory type
 */
export type ActionsFactory<T> = SharedActionsFactory<T>;

/**
 * Type for an action instance, which is a function that returns a slice creator
 * T represents the set of actions this instance contributes
 */
export type ActionInstance<T> = {
  (): SliceCreator<T>;
  __composition?: unknown;
  with<U>(
    factory: (tools: ActionsFactory<ComposedState<T, U>>) => U
  ): ActionInstance<ComposedState<T, U>>;
  create(): FinalizedAction<T>;
};

/**
 * Type for a finalized action, which can no longer be composed but is ready for use
 * This type represents the end of the composition phase
 */
export type FinalizedAction<T> = {
  (): SliceCreator<T>;
  __finalized: true;
};

/**
 * Utility type to extract the state type from a ActionInstance
 */
export type ActionState<T extends ActionInstance<any>> =
  T extends ActionInstance<infer S> ? S : never;

/**
 * Utility type for composing two action state types
 */
export type ComposedState<T, U> = T & U;

/**
 * Utility type for a composed action instance
 */
export type ComposedActionInstance<
  T extends ActionInstance<any>,
  U extends ActionInstance<any>,
> = ActionInstance<ComposedState<ActionState<T>, ActionState<U>>>;