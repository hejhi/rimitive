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
 * Complete set of all runtime tools available in the system
 */
export type AllRuntimeTools<T> = {
  get: GetState<T>;
  set: SetState<T>;
  mutate: MutateFunction;
  derive: DeriveFunction;
  dispatch: DispatchFunction;
};

/**
 * Type for a factory function with flexible tool options
 * Accepts any of the domain-specific factory types
 */
export type RuntimeTools<T> =
  | ModelFactory<T>
  | StateFactory<T>
  | ActionsFactory<T>
  | ViewFactory<T>;

/**
 * Type for a slice creator function that will be called with appropriate parameters.
 * Creates a zustand slice creator that will be turned into a zustand store.
 */
export type SliceFactory<T> = (options: RuntimeTools<T>) => T;

/**
 * Type for a base instance (model, state, actions or view)
 * T represents the slice this instance contributes
 * F represents the factory tools type (ModelFactory, StateFactory, etc.)
 */
export type BaseInstance<T, F = RuntimeTools<T>> = {
  (): SliceFactory<T>;
  __composition?: unknown;
  with<U, E = F>(
    factory: (tools: E) => U
  ): BaseInstance<ComposedState<T, U>, E>;
  create(): Finalized<T>;
};

/**
 * Type for a finalized instance, which can no longer be composed but is ready for use
 */
export type Finalized<T> = {
  (): SliceFactory<T>;
  __finalized: true;
};

/**
 * Utility type to extract the state type from a BaseInstance
 */
export type InstanceState<T extends BaseInstance<any>> =
  T extends BaseInstance<infer S> ? S : never;

/**
 * Utility type for composing two state types
 */
export type ComposedState<T, U> = T & U;

/**
 * Brand symbols for runtime type identification
 */
// Factory brand symbols
export const MODEL_FACTORY_BRAND = Symbol('model-factory');
export const STATE_FACTORY_BRAND = Symbol('state-factory');
export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
export const VIEW_FACTORY_BRAND = Symbol('view-factory');

// Instance brand symbols
export const MODEL_INSTANCE_BRAND = Symbol('model-instance');
export const STATE_INSTANCE_BRAND = Symbol('state-instance');
export const ACTIONS_INSTANCE_BRAND = Symbol('actions-instance');
export const VIEW_INSTANCE_BRAND = Symbol('view-instance');

/**
 * Symbol-based branded type helpers for TypeScript type safety
 * These types enforce that objects have the corresponding brand symbol property
 * This provides a unified approach that works for both runtime checks and compile-time type safety
 */
// Instance branding type utility
export type SymbolBranded<T, S extends symbol> = T & Record<S, true>;

// Instance branded types
export type ModelBranded<T> = SymbolBranded<T, typeof MODEL_INSTANCE_BRAND>;
export type StateBranded<T> = SymbolBranded<T, typeof STATE_INSTANCE_BRAND>;
export type ActionsBranded<T> = SymbolBranded<T, typeof ACTIONS_INSTANCE_BRAND>;
export type ViewBranded<T> = SymbolBranded<T, typeof VIEW_INSTANCE_BRAND>;

/**
 * Specific instance types that use symbol branding
 */
export type ModelInstance<T> = ModelBranded<BaseInstance<T, ModelFactory<T>>>;
export type StateInstance<T> = StateBranded<BaseInstance<T, StateFactory<T>>>;
export type ActionInstance<T> = ActionsBranded<
  BaseInstance<T, ActionsFactory<T>>
>;
export type ViewInstance<T> = ViewBranded<BaseInstance<T, ViewFactory<T>>>;

/**
 * Factory branded types using the same symbol-based approach as instances
 */
export type ModelFactoryBranded<T> = SymbolBranded<
  T,
  typeof MODEL_FACTORY_BRAND
>;
export type StateFactoryBranded<T> = SymbolBranded<
  T,
  typeof STATE_FACTORY_BRAND
>;
export type ActionsFactoryBranded<T> = SymbolBranded<
  T,
  typeof ACTIONS_FACTORY_BRAND
>;
export type ViewFactoryBranded<T> = SymbolBranded<T, typeof VIEW_FACTORY_BRAND>;

/**
 * Branded factory types with specific required properties
 */
export type ModelFactory<T> = ModelFactoryBranded<
  Pick<AllRuntimeTools<T>, 'get' | 'set'>
>;

export type StateFactory<T> = StateFactoryBranded<
  Pick<AllRuntimeTools<T>, 'get' | 'derive'>
>;

export type ActionsFactory<T> = ActionsFactoryBranded<
  Pick<AllRuntimeTools<T>, 'mutate'>
>;

export type ViewFactory<T> = ViewFactoryBranded<
  Pick<AllRuntimeTools<T>, 'derive' | 'dispatch'>
>;

// In-source tests
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should compile with correct type inference', () => {
    // This test is type-level only
    type TestState = {
      count: number;
      increment: () => void;
    };

    type TestInstance = BaseInstance<TestState>;

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
