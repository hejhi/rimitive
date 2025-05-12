import type { StoreApi } from 'zustand';

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
 * Type utility for creating branded types
 */
export type Branded<T, BrandSymbol extends symbol> = T & {
  readonly [key in BrandSymbol]: true;
};

/**
 * Zustand state management types
 */
export type SetState<T> = StoreApi<T>['setState'];
export type GetState<T> = StoreApi<T>['getState'];

/**
 * Function type utilities
 */
// Get function keys from a type
export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T] &
  keyof T;

/**
 * Base tools types
 */
export interface ModelFactoryTools<T> {
  get: GetState<T>;
  set: SetState<T>;
}

export interface StateFactoryTools<T> {
  get: GetState<T>;
  derive: <M, K extends keyof M>(model: M, key: K) => M[K];
}

export interface ActionsFactoryTools {
  mutate: <M, K extends keyof M>(
    model: M,
    methodName: K
  ) => M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never;
}

export interface ViewFactoryTools {
  derive: <M, K extends keyof M>(model: M, key: K) => M[K];
  dispatch: <A, K extends keyof A>(
    actions: A,
    actionName: K
  ) => A[K] extends (...args: infer P) => infer R ? (...args: P) => R : never;
}

export type BaseFactoryTools<T> =
  | ModelFactoryTools<T>
  | StateFactoryTools<T>
  | ActionsFactoryTools
  | ViewFactoryTools;

/**
 * Factory shape function types
 */
export type Model<T> = (tools: ModelFactoryTools<T>) => T;
export type State<T> = (tools: StateFactoryTools<T>) => T;
export type Actions<T> = (tools: ActionsFactoryTools) => T;
export type View<T> = (tools: ViewFactoryTools) => T;

// Union of all factory shape types
export type BaseFactoryShape<T> = Model<T> | State<T> | Actions<T> | View<T>;

/**
 * Branded tools types
 */
export type BrandedModelFactoryTools<T> = Branded<
  ModelFactoryTools<T>,
  typeof MODEL_FACTORY_BRAND
>;
export type BrandedStateFactoryTools<T> = Branded<
  StateFactoryTools<T>,
  typeof STATE_FACTORY_BRAND
>;
export type BrandedActionsFactoryTools = Branded<
  ActionsFactoryTools,
  typeof ACTIONS_FACTORY_BRAND
>;
export type BrandedViewFactoryTools = Branded<
  ViewFactoryTools,
  typeof VIEW_FACTORY_BRAND
>;

/**
 * Factory function types
 */
export type ModelFactory<T> = (tools: BrandedModelFactoryTools<T>) => T;
export type StateFactory<T> = (tools: BrandedStateFactoryTools<T>) => T;
export type ActionsFactory<T> = (tools: BrandedActionsFactoryTools) => T;
export type ViewFactory<T> = (tools: BrandedViewFactoryTools) => T;

// Union of all factory types
export type BaseFactory<T> =
  | ModelFactory<T>
  | StateFactory<T>
  | ActionsFactory<T>
  | ViewFactory<T>;

/**
 * Instance types
 */
export type ModelInstance<T> = Branded<
  () => (options: ModelFactoryTools<T>) => T,
  typeof MODEL_INSTANCE_BRAND
>;
export type StateInstance<T> = Branded<
  () => (options: StateFactoryTools<T>) => T,
  typeof STATE_INSTANCE_BRAND
>;
export type ActionsInstance<T> = Branded<
  () => (options: ActionsFactoryTools) => T,
  typeof ACTIONS_INSTANCE_BRAND
>;
export type ViewInstance<T> = Branded<
  () => (options: ViewFactoryTools) => T,
  typeof VIEW_INSTANCE_BRAND
>;

// Union of all instance types
export type BaseInstance<T> =
  | ModelInstance<T>
  | StateInstance<T>
  | ActionsInstance<T>
  | ViewInstance<T>;

/**
 * Lattice component types
 */
export interface LatticeLike<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly model: ModelInstance<TModel>;
  readonly state: StateInstance<TState>;
  readonly actions: ActionsInstance<TActions>;
  readonly view: {
    readonly [K in keyof TViews]: ViewInstance<TViews[K]>;
  };
}

/**
 * Partial lattice for testing purposes
 * Allows individual components to be optional
 */
export interface PartialLattice {
  readonly model?: unknown;
  readonly state?: unknown;
  readonly actions?: unknown;
  readonly view?: Record<string, unknown>;
}

// Add the PREPARED_BRAND symbol
export const PREPARED_BRAND: unique symbol = Symbol('PREPARED_BRAND');

export type PreparedModelInstance<T> = ModelInstance<T> & {
  [PREPARED_BRAND]: true;
};
export type PreparedStateInstance<T> = StateInstance<T> & {
  [PREPARED_BRAND]: true;
};
export type PreparedActionsInstance<T> = ActionsInstance<T> & {
  [PREPARED_BRAND]: true;
};
export type PreparedViewInstance<T> = ViewInstance<T> & {
  [PREPARED_BRAND]: true;
};
