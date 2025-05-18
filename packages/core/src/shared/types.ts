import type { StoreApi } from 'zustand/vanilla';

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
export const COMPONENT_FACTORY_INSTANCE_BRAND = Symbol('component-factory-instance');

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
 * Helper type to extract the actual model type from a model factory
 */
export type ExtractModelType<M> =
  M extends ModelFactory<infer T>
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
  // Enhanced mutate function for both ModelFactory and regular objects
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
 * This is needed for backwards compatibility with view factory functions
 */
export type ViewParamsToToolsAdapter<T, TSelectors, TActions> =
  ViewFactoryParams<TSelectors, TActions> & {
    get?: () => T;
  };

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
 * Slice factory function types with object parameters
 * 
 * These represent the user-provided factory functions that define the behavior
 * of each slice type (model, selectors, actions, views)
 */
export type ModelSliceFactory<T> = ModelFactoryCallback<T>;

export type SelectorsSliceFactory<T, TModel> = SelectorsFactoryCallback<T, TModel>;

export type ActionsSliceFactory<T, TModel> = ActionsFactoryCallback<T, TModel>;

export type ViewSliceFactory<T, TSelectors, TActions> = ViewFactoryCallback<
  T,
  TSelectors,
  TActions
>;


/**
 * Branded tools types
 */
export type BrandedModelTools<T> = Branded<
  StoreFactoryTools<T>,
  typeof MODEL_TOOLS_BRAND
>;
export type BrandedSelectorsTools<T, TModel = unknown> = Branded<
  SelectFactoryTools<T, TModel>,
  typeof SELECTORS_TOOLS_BRAND
>;
export type BrandedActionsTools = Branded<
  ActionsFactoryTools,
  typeof ACTIONS_TOOLS_BRAND
>;
export type BrandedViewTools<T> = Branded<
  SelectFactoryTools<T>,
  typeof VIEW_TOOLS_BRAND
>;


/**
 * Factory types (previously instance types)
 * 
 * These are the primary factory types used throughout the system.
 * They represent branded factory functions that can be composed and eventually
 * instantiated with runtime tools.
 */
export type ModelFactory<T> = Branded<
  () => (options: StoreFactoryTools<T>) => T,
  typeof MODEL_FACTORY_BRAND
>;
export type SelectorsFactory<T> = Branded<
  () => (options: SelectFactoryTools<T>) => T,
  typeof SELECTORS_FACTORY_BRAND
>;
export type ActionsFactory<T> = Branded<
  () => (options: ActionsFactoryTools) => T,
  typeof ACTIONS_FACTORY_BRAND
>;
/**
 * The ViewFactory type represents a view factory that can be composed with others
 * It's a function that returns a function that takes the tools and returns the view data
 * The generics represent:
 * - T: The view data type
 * - TSelectors: The type of selectors this view needs access to
 * - TActions: The type of actions this view needs access to
 */
export type ViewFactory<T, TSelectors = unknown, TActions = unknown> = Branded<
  () => (options: ViewParamsToToolsAdapter<T, TSelectors, TActions>) => T,
  typeof VIEW_FACTORY_BRAND
>;

// Union of all factory types
export type BaseFactory<T> =
  | ModelFactory<T>
  | SelectorsFactory<T>
  | ActionsFactory<T>
  | ViewFactory<T>;


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
  readonly getActions: () => ActionsFactory<TActions>;

  // View accessors with name-based retrieval
  readonly getView: <K extends keyof TViews>(
    viewName: K
  ) => ViewFactory<TViews[K]>;
  readonly getAllViews: () => {
    readonly [K in keyof TViews]: ViewFactory<TViews[K]>;
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
  actions: ActionsFactory<TActions>;

  /**
   * A record of named view factories
   * Each key is a view name, and the value is a view factory
   */
  view: {
    [K in keyof TViews]: ViewFactory<TViews[K]>;
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
  model?: ModelFactory<TModel>;

  /**
   * Optional selectors extension
   * If provided, replaces the base selectors
   */
  selectors?: SelectorsFactory<TSelectors>;

  /**
   * Optional actions extension
   * If provided, replaces the base actions
   */
  actions?: ActionsFactory<TActions>;

  /**
   * Optional view extensions
   * Can include new views or override existing views
   */
  view?: {
    [K in keyof TViews]?: ViewFactory<TViews[K]>;
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
  TViews extends Record<string, unknown>,
> {
  /**
   * The model factory of the component
   */
  model: ModelFactory<TModel>;

  /**
   * The selectors factory of the component
   */
  selectors: SelectorsFactory<TSelectors>;

  /**
   * The actions factory of the component
   */
  actions: ActionsFactory<TActions>;

  /**
   * The view factories of the component
   */
  view: {
    readonly [K in keyof TViews]: ViewFactory<TViews[K]>;
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
  TExtViews extends TBaseViews,
> = (
  elements: ComponentElements<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews
  >
) => ComponentExtension<TExtModel, TExtSelectors, TExtActions, TExtViews>;
