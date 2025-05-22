/**
 * Core type definitions for Lattice components
 * Production-quality types with full type safety and no compromises
 */

/**
 * Brand symbols for runtime type identification
 */
export const MODEL_TOOLS_BRAND = Symbol('model-tools');
export const SELECTORS_TOOLS_BRAND = Symbol('selectors-tools');
export const ACTIONS_TOOLS_BRAND = Symbol('actions-tools');
export const VIEW_TOOLS_BRAND = Symbol('view-tools');
export const COMPONENT_FACTORY_BRAND = Symbol('component-factory');

export const MODEL_FACTORY_BRAND = Symbol('model-factory');
export const SELECTORS_FACTORY_BRAND = Symbol('selectors-factory');
export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
export const VIEW_FACTORY_BRAND = Symbol('view-factory');
export const COMPONENT_FACTORY_INSTANCE_BRAND = Symbol(
  'component-factory-instance'
);

export const LATTICE_BRAND = Symbol('lattice');

/**
 * Type utility for creating branded types
 */
export type Branded<T, BrandSymbol extends symbol> = T & {
  readonly [key in BrandSymbol]: true;
};

/**
 * Core state management interface
 */
export type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: false | undefined
) => void;

export type GetState<T> = () => T;

/**
 * Model factory parameters and callback types
 */
export type ModelFactoryParams<TShape> = {
  set: SetState<TShape>;
  get: GetState<TShape>;
};

export type ModelSliceFactory<T> = (params: ModelFactoryParams<T>) => T;

/**
 * Selectors factory parameters and callback types
 */
export type SelectorsFactoryParams<TModel> = {
  model: () => TModel;
};

export type SelectorsSliceFactory<T, TModel> = (
  params: SelectorsFactoryParams<TModel>
) => T;

/**
 * Actions factory parameters and callback types
 */
export type ActionsFactoryParams<TModel> = {
  model: () => TModel;
};

export type ActionsSliceFactory<T, TModel> = (
  params: ActionsFactoryParams<TModel>
) => T;

/**
 * View factory parameters and callback types
 */
export type ViewFactoryParams<TSelectors, TActions> = {
  selectors: () => TSelectors;
  actions: () => TActions;
};

export type ViewSliceFactory<T, TSelectors, TActions> = (
  params: ViewFactoryParams<TSelectors, TActions>
) => T;

/**
 * Factory types - branded factory functions for composition
 */
export type ModelFactory<T> = Branded<
  <S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) => (options: ModelFactoryParams<T>) => S,
  typeof MODEL_FACTORY_BRAND
>;

export type SelectorsFactory<T, TModel = unknown> = Branded<
  <S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) => (options: SelectorsFactoryParams<TModel>) => S,
  typeof SELECTORS_FACTORY_BRAND
>;

export type ActionsFactory<T, TModel = unknown> = Branded<
  <S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) => (options: ActionsFactoryParams<TModel>) => S,
  typeof ACTIONS_FACTORY_BRAND
>;

export type ViewFactory<T, TSelectors = unknown, TActions = unknown> = Branded<
  <S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) => (options: ViewFactoryParams<TSelectors, TActions>) => S,
  typeof VIEW_FACTORY_BRAND
>;

/**
 * Lattice component interface
 */
export interface LatticeLike<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly getModel: () => ModelFactory<TModel>;
  readonly getSelectors: () => SelectorsFactory<TSelectors, TModel>;
  readonly getActions: () => ActionsFactory<TActions, TModel>;
  readonly getView: <K extends keyof TViews>(
    viewName: K
  ) => ViewFactory<TViews[K], TSelectors, TActions>;
  readonly getAllViews: () => {
    readonly [K in keyof TViews]: ViewFactory<TViews[K], TSelectors, TActions>;
  };
}

/**
 * Branded Lattice type
 */
export type Lattice<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  LatticeLike<TModel, TSelectors, TActions, TViews>,
  typeof LATTICE_BRAND
>;

/**
 * Component configuration
 */
export type ComponentConfig<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = {
  model: ModelFactory<TModel>;
  selectors: SelectorsFactory<TSelectors, TModel>;
  actions: ActionsFactory<TActions, TModel>;
  view: {
    [K in keyof TViews]: ViewFactory<TViews[K], TSelectors, TActions>;
  };
};

/**
 * Component factory types
 */
export type ComponentFactory<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  () => Lattice<TModel, TSelectors, TActions, TViews>,
  typeof COMPONENT_FACTORY_BRAND
>;

export type ComponentFactoryInstance<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  () => Lattice<TModel, TSelectors, TActions, TViews>,
  typeof COMPONENT_FACTORY_INSTANCE_BRAND
>;

/**
 * Component extension types
 */
export type ComponentExtension<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = {
  model?: ModelFactory<TModel>;
  selectors?: SelectorsFactory<TSelectors, TModel>;
  actions?: ActionsFactory<TActions, TModel>;
  view?: {
    [K in keyof TViews]?: ViewFactory<TViews[K], TSelectors, TActions>;
  };
};

export type WithComponentCallback<
  TBaseModel,
  TBaseSelectors,
  TBaseActions,
  TBaseViews extends Record<string, unknown>,
  TExtModel extends TBaseModel,
  TExtSelectors extends TBaseSelectors,
  TExtActions extends TBaseActions,
  TExtViews extends TBaseViews,
> = (
  elements: ComponentConfig<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews
  >
) => ComponentExtension<TExtModel, TExtSelectors, TExtActions, TExtViews>;

/**
 * Subscription callback type for state changes
 */
export type SubscribeCallback = () => void;

/**
 * Unsubscribe function returned by subscribe
 */
export type UnsubscribeFunction = () => void;

/**
 * Standardized Lattice API interface
 *
 * This is the contract that all store adapters must implement
 * and all framework adapters can consume. It provides a unified
 * interface for accessing component state and behavior regardless
 * of the underlying state management solution.
 *
 * @template TSelectors - The selectors type for the component
 * @template TActions - The actions type for the component
 * @template TViews - The views type for the component
 */
export interface LatticeAPI<
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Access the current selector values.
   * Selectors are derived state and computed values from the model.
   *
   * @returns The current selectors object
   * @example
   * const selectors = api.getSelectors();
   * const count = selectors.count;
   * const isEven = selectors.isEven();
   */
  getSelectors: () => TSelectors;

  /**
   * Access the action functions.
   * Actions are functions that can modify the model state.
   *
   * @returns The actions object with bound functions
   * @example
   * const actions = api.getActions();
   * actions.increment();
   * actions.setValue(42);
   */
  getActions: () => TActions;

  /**
   * Subscribe to state changes.
   * The callback will be invoked whenever any part of the state changes.
   *
   * @param callback - Function to call on state changes
   * @returns A function to unsubscribe
   * @example
   * const unsubscribe = api.subscribe(() => {
   *   console.log('State changed!');
   * });
   * // Later: unsubscribe();
   */
  subscribe: (callback: SubscribeCallback) => UnsubscribeFunction;

  /**
   * Access the view functions.
   * Views generate UI attributes and event handlers based on current state.
   *
   * @returns The views object with view generator functions
   * @example
   * const views = api.getViews();
   * const buttonProps = views.button();
   * // { onClick: [Function], disabled: false, 'aria-label': 'Click me' }
   */
  getViews: () => TViews;

  /**
   * Clean up and destroy the component instance.
   * This should release all resources, unsubscribe all listeners,
   * and perform any necessary cleanup.
   *
   * @example
   * // When component is no longer needed
   * api.destroy();
   */
  destroy: () => void;
}
