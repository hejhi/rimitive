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
 * Type for a model method reference mutator (for actions)
 */
export type MutateFunction = <M, K extends keyof M>(
  model: M,
  key: K
) => M[K] extends (...args: infer A) => infer R ? (...args: A) => R : never;

/**
 * Type for a derive function (for states)
 */
export type DeriveFunction = <M, K extends keyof M, R = M[K]>(
  model: M,
  key: K,
  transform?: (value: M[K]) => R
) => R;

/**
 * Type for a dispatch function (for views)
 */
export type DispatchFunction = <A, K extends keyof A>(
  actions: A,
  key: K
) => A[K];

/**
 * Type for a factory function with flexible tool options
 */
export type RuntimeTools<T> = {
  get?: GetState<T>;
  set?: SetState<T>;
  mutate?: MutateFunction;
  derive?: DeriveFunction;
  dispatch?: DispatchFunction;
};

/**
 * Type for a slice creator function that will be called with appropriate parameters
 */
export type SliceCreator<T> = (options: RuntimeTools<T>) => T;

/**
 * Type for an instance (model, state, actions or view)
 * T represents the slice this instance contributes
 */
export type Instance<T, F = unknown> = {
  (): SliceCreator<T>;
  __composition?: unknown;
  with<U>(
    factory: (tools: RuntimeTools<ComposedState<T, U>>) => U
  ): Instance<ComposedState<T, U>, F>;
  create(): Finalized<T>;
};

/**
 * Type for a finalized instance, which can no longer be composed but is ready for use
 */
export type Finalized<T> = {
  (): SliceCreator<T>;
  __finalized: true;
};

/**
 * Utility type to extract the state type from an Instance
 */
export type InstanceState<T extends Instance<any>> =
  T extends Instance<infer S> ? S : never;

/**
 * Utility type for composing two state types
 */
export type ComposedState<T, U> = T & U;

/**
 * Utility type for a composed instance
 */
export type ComposedInstance<
  T extends Instance<any>,
  U extends Instance<any>,
  F = unknown,
> = Instance<ComposedState<InstanceState<T>, InstanceState<U>>, F>;

/**
 * Branded types for different factory types
 */
export interface ModelFactoryBrand {
  readonly __modelFactoryBrand: unique symbol;
}

export interface StateFactoryBrand {
  readonly __stateFactoryBrand: unique symbol;
}

export interface ActionsFactoryBrand {
  readonly __actionsFactoryBrand: unique symbol;
}

export interface ViewFactoryBrand {
  readonly __viewFactoryBrand: unique symbol;
}

/**
 * Branded factory types with specific required properties
 */
export type ModelFactory<T> = RuntimeTools<T> & {
  get: GetState<T>;
  set: SetState<T>;
} & ModelFactoryBrand;

export type StateFactory<T> = RuntimeTools<T> & {
  get: GetState<T>;
  derive: DeriveFunction;
} & StateFactoryBrand;

export type ActionsFactory<T> = RuntimeTools<T> & {
  mutate: MutateFunction;
} & ActionsFactoryBrand;

export type ViewFactory<T> = RuntimeTools<T> & {
  derive: DeriveFunction;
  dispatch: DispatchFunction;
} & ViewFactoryBrand;

// In-source tests
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should compile with correct type inference', () => {
    // This test is type-level only
    type TestState = {
      count: number;
      increment: () => void;
    };

    type TestInstance = Instance<TestState>;

    // The type should be a function
    const isFunction: TestInstance extends Function ? true : false = true;
    expect(isFunction).toBe(true);

    // It should have .with and .create methods
    type HasWithMethod = TestInstance extends { with: Function } ? true : false;
    type HasCreateMethod = TestInstance extends { create: Function }
      ? true
      : false;

    const hasWithMethod: HasWithMethod = true;
    const hasCreateMethod: HasCreateMethod = true;

    expect(hasWithMethod).toBe(true);
    expect(hasCreateMethod).toBe(true);
  });
}
