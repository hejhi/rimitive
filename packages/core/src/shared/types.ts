import type { StoreApi } from 'zustand/vanilla';

/**
 * Brand symbols for runtime type identification
 */
// Factory brand symbols
export const MODEL_FACTORY_BRAND = Symbol('model-factory');
export const SELECTORS_FACTORY_BRAND = Symbol('selectors-factory');
export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
export const VIEW_FACTORY_BRAND = Symbol('view-factory');
export const MUTATION_BRAND = Symbol('mutation-brand');
export const COMPONENT_FACTORY_BRAND = Symbol('component-factory');

// Instance brand symbols
export const MODEL_INSTANCE_BRAND = Symbol('model-instance');
export const SELECTORS_INSTANCE_BRAND = Symbol('selectors-instance');
export const ACTIONS_INSTANCE_BRAND = Symbol('actions-instance');
export const VIEW_INSTANCE_BRAND = Symbol('view-instance');
export const COMPONENT_INSTANCE_BRAND = Symbol('component-instance');

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
 * Helper type to infer the underlying model type from a component
 * This is used in the composition pattern to automatically infer the model type
 */
export type InferModelType<T> = T extends { __MODEL_TYPE__: infer M }
  ? M
  : never;

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
 * New object-parameter based factory parameter types
 */

/**
 * Model factory parameters and callback types
 */
export interface ModelFactoryParams<T> {
  set: SetState<T>;
  get: GetState<T>;
}

export type ModelFactoryCallback<T> = (params: ModelFactoryParams<T>) => T;

/**
 * Selectors factory parameters and callback types
 */
export interface SelectorsFactoryParams<TModel> {
  model: () => TModel;
}

export interface SelectFactoryTools<T, TModel = unknown> {
  get: GetState<T>;
  model?: () => TModel; // Optional but properly typed model accessor function
}

export type SelectorsFactoryCallback<T, TModel> = (
  params: SelectorsFactoryParams<TModel>
) => T;

/**
 * Actions factory parameters and callback types
 */
export interface ActionsFactoryParams<TModel> {
  model: () => TModel;
}

export type ActionsFactoryCallback<T, TModel> = (
  params: ActionsFactoryParams<TModel>
) => T;

/**
 * View factory parameters and callback types
 */
export interface ViewFactoryParams<TSelectors, TActions> {
  selectors: () => TSelectors;
  actions: () => TActions;
}

/**
 * Adapter that maps ViewFactoryParams to SelectFactoryTools
 * This is needed for backwards compatibility with view instance functions
 */
export type ViewParamsToToolsAdapter<T, TSelectors, TActions> = ViewFactoryParams<TSelectors, TActions> & {
  get?: () => T;
}

export type ViewFactoryCallback<T, TSelectors, TActions> = (
  params: ViewFactoryParams<TSelectors, TActions>
) => T;

/**
 * Composition types
 */
export type ComponentType = 'model' | 'selectors' | 'actions' | 'view';

// Tools interfaces for composition
export interface ModelCompositionTools<B, E> {
  set: SetState<B & E>;
  get: GetState<B & E>;
}

export interface SelectorsCompositionTools<TModel> {
  model: () => TModel;
}

export interface ActionsCompositionTools<TModel> {
  model: () => TModel;
}

export interface ViewCompositionTools<TSelectors, TActions> {
  selectors: () => TSelectors;
  actions: () => TActions;
}

export type SliceCompositionTools<
  T,
  C extends ComponentType,
> = C extends 'model'
  ? ModelFactoryParams<T>
  : C extends 'selectors'
    ? SelectorsFactoryParams<any>
    : C extends 'actions'
      ? ActionsFactoryParams<any>
      : C extends 'view'
        ? ViewFactoryParams<any, any>
        : never;

export type SliceCompositionCallback<Slice, Ext, C extends ComponentType> = (
  slice: Slice,
  tools: SliceCompositionTools<Slice & Ext, C>
) => Ext;

/**
 * Legacy factory shape function types
 *
 * Note: These types use positional parameters and are being phased out in favor
 * of the object parameter pattern above.
 */
export type Model<T> = (set: SetState<T>, get: GetState<T>) => T;

export type Selectors<T, TModel> = (getModel: GetState<TModel>) => T;

export type Actions<T, TModel> = (getModel: GetState<TModel>) => {
  [K in keyof T]: T[K] extends Mutation<any> ? T[K] : never;
};

export type View<T, TSelectors, TActions> = (
  getSelectors: GetState<TSelectors>,
  getActions: GetState<TActions>
) => T;

/**
 * Updated factory function types with object parameters
 */
export type ModelFactory<T> = ModelFactoryCallback<T>;

export type SelectorsFactory<T, TModel> = SelectorsFactoryCallback<T, TModel>;

export type ActionsFactory<T, TModel> = ActionsFactoryCallback<T, TModel>;

export type ViewFactory<T, TSelectors, TActions> = ViewFactoryCallback<
  T,
  TSelectors,
  TActions
>;

/**
 * Branded tools types
 */
export type BrandedModelFactoryTools<T> = Branded<
  StoreFactoryTools<T>,
  typeof MODEL_FACTORY_BRAND
>;
export type BrandedSelectorsFactoryTools<T, TModel = unknown> = Branded<
  SelectFactoryTools<T, TModel>,
  typeof SELECTORS_FACTORY_BRAND
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
 * Instance types
 */
export type ModelInstance<T> = Branded<
  () => (options: StoreFactoryTools<T>) => T,
  typeof MODEL_INSTANCE_BRAND
>;
export type SelectorsInstance<T> = Branded<
  () => (options: SelectFactoryTools<T>) => T,
  typeof SELECTORS_INSTANCE_BRAND
>;
export type ActionsInstance<T> = Branded<
  () => (options: ActionsFactoryTools) => T,
  typeof ACTIONS_INSTANCE_BRAND
>;
/**
 * The ViewInstance type represents a view that can be composed with others
 * It's a function that returns a function that takes the tools and returns the view data
 * The generics represent:
 * - T: The view data type
 * - TSelectors: The type of selectors this view needs access to
 * - TActions: The type of actions this view needs access to
 */
export type ViewInstance<T, TSelectors = unknown, TActions = unknown> = Branded<
  () => (options: ViewParamsToToolsAdapter<T, TSelectors, TActions>) => T,
  typeof VIEW_INSTANCE_BRAND
>;

// Union of all instance types
export type BaseInstance<T> =
  | ModelInstance<T>
  | SelectorsInstance<T>
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
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  // Internal accessor methods (not exposed publicly)
  readonly getModel: () => ModelInstance<TModel>;
  readonly getSelectors: () => SelectorsInstance<TSelectors>;
  readonly getActions: () => ActionsInstance<TActions>;

  // View accessors with name-based retrieval
  readonly getView: <K extends keyof TViews>(
    viewName: K
  ) => ViewInstance<TViews[K]>;
  readonly getAllViews: () => {
    readonly [K in keyof TViews]: ViewInstance<TViews[K]>;
  };
  
  // Internal store access (prefixed with double underscore to indicate internal use)
  readonly __store?: any;
  readonly __selectors?: any;
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
 * Partial lattice for testing purposes
 * Allows individual accessor methods to be optional
 */
export type PartialLattice = Partial<Omit<LatticeLike, typeof LATTICE_BRAND>>;

/**
 * Component types
 */

/**
 * Configuration for creating a component
 * This defines the required properties for component creation
 */
export interface ComponentConfig<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * The model instance for the component
   */
  model: ModelInstance<TModel>;

  /**
   * The selectors instance for the component
   */
  selectors: SelectorsInstance<TSelectors>;

  /**
   * The actions instance for the component
   */
  actions: ActionsInstance<TActions>;

  /**
   * A record of named view instances
   * Each key is a view name, and the value is a view instance
   */
  view: {
    [K in keyof TViews]: ViewInstance<TViews[K]>;
  };
}

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
 * Branded component instance type
 */
export type ComponentInstance<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  () => Lattice<TModel, TSelectors, TActions, TViews>,
  typeof COMPONENT_INSTANCE_BRAND
>;

/**
 * Tools for component composition
 */
export interface ComponentCompositionTools<
  TBaseModel = unknown,
  TBaseSelectors = unknown,
  TBaseActions = unknown,
  TBaseViews extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Access to the base component
   */
  component: Lattice<TBaseModel, TBaseSelectors, TBaseActions, TBaseViews>;
}

/**
 * Component extension with partial override
 * Allows selectively extending or replacing parts of a component
 */
export interface ComponentExtension<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Optional model extension
   * If provided, replaces the base model
   */
  model?: ModelInstance<TModel>;

  /**
   * Optional selectors extension
   * If provided, replaces the base selectors
   */
  selectors?: SelectorsInstance<TSelectors>;

  /**
   * Optional actions extension
   * If provided, replaces the base actions
   */
  actions?: ActionsInstance<TActions>;

  /**
   * Optional view extensions
   * Can include new views or override existing views
   */
  view?: {
    [K in keyof TViews]?: ViewInstance<TViews[K]>;
  };
}

/**
 * Component elements access structure
 * Provides direct access to component elements for composition
 */
export interface ComponentElements<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
> {
  /**
   * The model instance of the component
   */
  model: ModelInstance<TModel>;
  
  /**
   * The selectors instance of the component
   */
  selectors: SelectorsInstance<TSelectors>;
  
  /**
   * The actions instance of the component
   */
  actions: ActionsInstance<TActions>;
  
  /**
   * The view instances of the component
   */
  view: {
    readonly [K in keyof TViews]: ViewInstance<TViews[K]>;
  };
}

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
  TExtViews extends TBaseViews
> = (
  elements: ComponentElements<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews
  >
) => ComponentExtension<TExtModel, TExtSelectors, TExtActions, TExtViews>;
