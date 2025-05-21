/**
 * Brand symbols for runtime type identification
 */
// Tools brand symbols (previously factory brand symbols)
export const MODEL_TOOLS_BRAND = Symbol('model-tools');
export const SELECTORS_TOOLS_BRAND = Symbol('selectors-tools');
export const ACTIONS_TOOLS_BRAND = Symbol('actions-tools');
export const VIEW_TOOLS_BRAND = Symbol('view-tools');
export const MUTATION_BRAND = Symbol('mutation-brand');
export const COMPONENT_FACTORY_BRAND = Symbol('component-factory');

// Factory brand symbols (previously instance brand symbols)
export const MODEL_FACTORY_BRAND = Symbol('model-factory');
export const SELECTORS_FACTORY_BRAND = Symbol('selectors-factory');
export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
export const VIEW_FACTORY_BRAND = Symbol('view-factory');
export const COMPONENT_FACTORY_INSTANCE_BRAND = Symbol(
  'component-factory-instance'
);

// Lattice brand symbol
export const LATTICE_BRAND = Symbol('lattice');

/**
 * Type utility for creating branded types
 */
export type Branded<T, BrandSymbol extends symbol> = T & {
  readonly [key in BrandSymbol]: true;
};

/**
 * Generic state management adapter types
 * These provide the minimal interface that any store adapter must implement
 * Note: These are temporarily compatible with Zustand but will be abstracted further
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
 * Factory types (previously instance types)
 *
 * These are the primary factory types used throughout the system.
 * They represent branded factory functions that can be composed and eventually
 * instantiated with runtime tools.
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
 * Lattice component types - internal interface
 *
 * This uses a closure-based design for proper encapsulation:
 * - No direct property access
 * - Access via accessor methods for internal use
 * - Components can be properly isolated and hidden
 */
export interface LatticeLike<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  // Internal accessor methods (not exposed publicly)
  readonly getModel: () => ModelFactory<TModel>;
  readonly getSelectors: () => SelectorsFactory<TSelectors>;
  readonly getActions: () => ActionsFactory<TActions, TModel>;

  // View accessors with name-based retrieval
  readonly getView: <K extends keyof TViews>(
    viewName: K
  ) => ViewFactory<TViews[K], TSelectors, TActions>;
  readonly getAllViews: () => {
    readonly [K in keyof TViews]: ViewFactory<TViews[K], TSelectors, TActions>;
  };
}

/**
 * Branded Lattice type
 * Adds the brand symbol to the LatticeLike interface for runtime type checking
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
 * Configuration for creating a component
 * This defines the required properties for component creation
 */
export type ComponentConfig<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = {
  /**
   * The model factory for the component
   */
  model: ModelFactory<TModel>;

  /**
   * The selectors factory for the component
   */
  selectors: SelectorsFactory<TSelectors>;

  /**
   * The actions factory for the component
   */
  actions: ActionsFactory<TActions, TModel>;

  /**
   * A record of named view factories
   * Each key is a view name, and the value is a view factory
   */
  view: {
    [K in keyof TViews]: ViewFactory<TViews[K], TSelectors, TActions>;
  };
};

/**
 * Branded component factory type
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

/**
 * Branded component factory instance type
 */
export type ComponentFactoryInstance<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  () => Lattice<TModel, TSelectors, TActions, TViews>,
  typeof COMPONENT_FACTORY_INSTANCE_BRAND
>;

// Legacy type for backward compatibility - marked for deprecation
export type ComponentInstance<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = ComponentFactoryInstance<TModel, TSelectors, TActions, TViews>;

/**
 * Component extension with partial override
 * Allows selectively extending or replacing parts of a component
 */
export type ComponentExtension<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = {
  /**
   * Optional model extension
   * If provided, replaces the base model
   */
  model?: ModelFactory<TModel>;

  /**
   * Optional selectors extension
   * If provided, replaces the base selectors
   */
  selectors?: SelectorsFactory<TSelectors>;

  /**
   * Optional actions extension
   * If provided, replaces the base actions
   * TActions should already be an ActionsFactory type
   */
  actions?: ActionsFactory<TActions, TModel>;

  /**
   * Optional view extensions
   * Can include new views or override existing views
   */
  view?: {
    [K in keyof TViews]?: ViewFactory<TViews[K], TSelectors, TActions>;
  };
};

/**
 * Type for the withComponent callback function
 * Receives component elements and returns an extension
 */
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
