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
export const COMPONENT_FACTORY_INSTANCE_BRAND = Symbol('component-factory-instance');

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

export type SelectorsFactory<T> = Branded<
  <S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) => (options: SelectorsFactoryParams<T>) => S,
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
  readonly getSelectors: () => SelectorsFactory<TSelectors>;
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
  selectors: SelectorsFactory<TSelectors>;
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
  selectors?: SelectorsFactory<TSelectors>;
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