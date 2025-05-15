import type { StoreApi } from 'zustand/vanilla';

/**
 * Brand symbols for runtime type identification
 */
// Factory brand symbols
export const MODEL_FACTORY_BRAND = Symbol('model-factory');
export const STATE_FACTORY_BRAND = Symbol('state-factory');
export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
export const VIEW_FACTORY_BRAND = Symbol('view-factory');
export const MUTATION_BRAND = Symbol('mutation-brand');

// Instance brand symbols
export const MODEL_INSTANCE_BRAND = Symbol('model-instance');
export const STATE_INSTANCE_BRAND = Symbol('state-instance');
export const ACTIONS_INSTANCE_BRAND = Symbol('actions-instance');
export const VIEW_INSTANCE_BRAND = Symbol('view-instance');

// Lattice brand symbol
export const LATTICE_BRAND = Symbol('lattice');

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

export interface StoreFactoryTools<T> {
  get: GetState<T>;
  set: SetState<T>;
}

export interface SelectFactoryTools<T> {
  get: GetState<T>;
}

/**
 * Branded mutation type using symbol
 */
export type Mutation<T extends (...args: any[]) => any> = Branded<
  T,
  typeof MUTATION_BRAND
>;

/**
 * Helper type to extract the actual model type from a model instance
 */
export type ExtractModelType<M> =
  M extends ModelInstance<infer T>
    ? T
    : M extends () => any
      ? ReturnType<M>
      : M;

/**
 * Type for mutated model object with methods converted to mutations
 */
export type MutatedModel<M> = {
  [K in keyof ExtractModelType<M> & string]: ExtractModelType<M>[K] extends (
    ...args: infer P
  ) => infer R
    ? Mutation<(...args: P) => R>
    : never;
};

/**
 * Factory tools for creating actions
 */
export interface ActionsFactoryTools {
  // Enhanced mutate function for both ModelInstance and regular objects
  mutate: <M>(model: M) => MutatedModel<M>;
}

export type BaseFactoryTools<T> =
  | StoreFactoryTools<T>
  | SelectFactoryTools<T>
  | ActionsFactoryTools;

/**
 * Factory shape function types
 */
export type Model<T> = (tools: StoreFactoryTools<T>) => T;
export type State<T> = (tools: SelectFactoryTools<T>) => T;
export type View<T> = (tools: SelectFactoryTools<T>) => T;
export type Actions<T> = (tools: ActionsFactoryTools) => {
  [K in keyof T]: T[K] extends Mutation<any> ? T[K] : never;
};

// Union of all factory shape types
export type BaseFactoryShape<T> = Model<T> | State<T> | Actions<T> | View<T>;

/**
 * Branded tools types
 */
export type BrandedModelFactoryTools<T> = Branded<
  StoreFactoryTools<T>,
  typeof MODEL_FACTORY_BRAND
>;
export type BrandedStateFactoryTools<T> = Branded<
  SelectFactoryTools<T>,
  typeof STATE_FACTORY_BRAND
>;
export type BrandedActionsFactoryTools = Branded<
  ActionsFactoryTools,
  typeof ACTIONS_FACTORY_BRAND
>;
export type BrandedViewFactoryTools<T> = Branded<
  SelectFactoryTools<T>,
  typeof VIEW_FACTORY_BRAND
>;

/**
 * Factory function types
 */
export type ModelFactory<T> = (tools: BrandedModelFactoryTools<T>) => T;
export type StateFactory<T> = (tools: BrandedStateFactoryTools<T>) => T;
export type ActionsFactory<T> = (tools: BrandedActionsFactoryTools) => {
  [K in keyof T]: T[K] extends Mutation<any> ? T[K] : never;
};
export type ViewFactory<T> = (tools: BrandedViewFactoryTools<T>) => T;

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
  () => (options: StoreFactoryTools<T>) => T,
  typeof MODEL_INSTANCE_BRAND
>;
export type StateInstance<T> = Branded<
  () => (options: SelectFactoryTools<T>) => T,
  typeof STATE_INSTANCE_BRAND
>;
export type ActionsInstance<T> = Branded<
  () => (options: ActionsFactoryTools) => T,
  typeof ACTIONS_INSTANCE_BRAND
>;
export type ViewInstance<T> = Branded<
  () => (options: SelectFactoryTools<T>) => T,
  typeof VIEW_INSTANCE_BRAND
>;

// Union of all instance types
export type BaseInstance<T> =
  | ModelInstance<T>
  | StateInstance<T>
  | ActionsInstance<T>
  | ViewInstance<T>;

/**
 * Lattice component types - internal interface
 *
 * This uses a closure-based design for proper encapsulation:
 * - No direct property access
 * - Access via accessor methods for internal use
 * - Components can be properly isolated and hidden
 */
export interface LatticeLike<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  // Internal accessor methods (not exposed publicly)
  readonly getModel: () => ModelInstance<TModel>;
  readonly getState: () => StateInstance<TState>;
  readonly getActions: () => ActionsInstance<TActions>;

  // View accessors with name-based retrieval
  readonly getView: <K extends keyof TViews>(
    viewName: K
  ) => ViewInstance<TViews[K]>;
  readonly getAllViews: () => {
    readonly [K in keyof TViews]: ViewInstance<TViews[K]>;
  };
}

/**
 * Branded Lattice type
 * Adds the brand symbol to the LatticeLike interface for runtime type checking
 */
export type Lattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  LatticeLike<TModel, TState, TActions, TViews>,
  typeof LATTICE_BRAND
>;

/**
 * Partial lattice for testing purposes
 * Allows individual accessor methods to be optional
 */
export type PartialLattice = Partial<Omit<LatticeLike, typeof LATTICE_BRAND>>;
