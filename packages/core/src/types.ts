// --- Lattice Core Types: Two-Phase Contract Enforcement ---
// See: docs/draft-spec.md (Composition and Extension Function Pattern)

import {
  ACTIONS_FACTORY_TYPE,
  LATTICE_TYPE,
  MODEL_FACTORY_TYPE,
  STATE_FACTORY_TYPE,
  VIEW_FACTORY_TYPE,
} from './constants';

/**
 * DerivedValue interface for tracking derivation metadata.
 * Represents a value derived from another source with metadata for dependency tracking.
 */
export type DerivedValue<T> = T & {
  __id?: string;
  source?: any;
  path?: string;
  transformer?: (value: any) => unknown;
  value?: T;
  valueOf?: () => T;
  toString?: () => string;
};

/**
 * The function signature for the extension phase of a two-phase factory.
 * Accepts any arguments and returns the final contract/API surface.
 * This is intentionally generic, as the contract is established by the composition phase.
 */
export type ExtensionPhaseFn<Args extends unknown[], Result> = (
  ...args: Args
) => Result;

/**
 * The proxy returned by the composition phase, which must be called as a function (the extension phase).
 * Any other usage (property access, etc.) is illegal and will throw at runtime.
 */
export type TwoPhaseEnforcementProxy<Args extends unknown[], Result> = (props: {
  (...args: Args): Result;
  // Any property access is illegal and will throw at runtime (enforced by Proxy)
}) => any;

/**
 * The factory signature for all Lattice two-phase factories (model, state, actions, view).
 * The composition phase returns a proxy that enforces the contract boundary.
 */
export type TwoPhaseFactory<
  CompositionArgs extends unknown[],
  ExtensionArgs extends unknown[],
  Result,
> = (
  ...args: CompositionArgs
) => TwoPhaseEnforcementProxy<ExtensionArgs, Result>;

// --- Contract Types (result of extension phase) ---
export interface ModelContract {
  [key: string]: unknown;
}

export interface StateContract {
  [key: string]: unknown;
}

export interface ActionsContract {
  [key: string]: (...args: unknown[]) => unknown;
}

export interface ViewContract {
  [key: string]: unknown;
}

// --- Extension Phase Helper Types ---
export interface ModelExtensionHelpers {
  get: () => Record<string, unknown>;
  set: (state: Record<string, unknown>) => void;
}

/**
 * StateExtensionHelpers interface provides methods for building the state contract.
 * The 'derive' method now supports reactive updates during runtime through subscription.
 */
export interface StateExtensionHelpers {
  /**
   * Gets the current state values.
   */
  get: () => Record<string, unknown>;

  /**
   * Derives a value from a source, tracking dependencies for validation
   * and enabling reactivity through subscription.
   *
   * During runtime (after zustand store creation), the derived values can
   * subscribe to their sources, allowing for reactive updates when those sources change.
   *
   * @param source The source object to derive from
   * @param property The property name to derive
   * @param transformer Optional transformation function to apply to the derived value
   * @returns A derived value that can participate in the reactivity system
   */
  derive: <T>(
    source: any,
    property: string,
    transformer?: (value: T) => unknown
  ) => T;
}

export interface ActionsExtensionHelpers {
  mutate: (source: any, property: string) => (...args: unknown[]) => unknown;
}

/**
 * ViewExtensionHelpers interface provides methods for building the view contract.
 * The 'derive' method now supports reactive updates during runtime through subscription.
 */
export interface ViewExtensionHelpers {
  /**
   * Derives a value from a source for a view, tracking dependencies for validation
   * and enabling reactivity through subscription.
   *
   * During runtime, view components can subscribe to derived state values,
   * allowing for reactive updates when those values change.
   *
   * @param source The source object to derive from
   * @param property The property name to derive
   * @param transformer Optional transformation function to apply to the derived value
   * @returns A derived value that can participate in the reactivity system
   */
  derive: <T>(
    source: any,
    property: string,
    transformer?: (value: T) => unknown
  ) => T;

  /**
   * Creates a dispatch function that will call an action when invoked.
   *
   * @param source The source actions contract
   * @param property The action name to dispatch to
   * @returns A function that when called will invoke the specified action
   */
  dispatch: (source: any, property: string) => (...args: unknown[]) => unknown;
}

// --- Composition Phase Helper Types ---
export interface ModelCompositionHelpers {
  model: Record<string, unknown>;
  select: <T>(obj: Record<string, unknown>, key: string) => T;
}

export interface StateCompositionHelpers {
  state: Record<string, unknown>;
  select: <T>(obj: Record<string, unknown>, key: string) => T;
}

export interface ActionsCompositionHelpers {
  actions: Record<string, (...args: unknown[]) => unknown>;
  select: <T>(obj: Record<string, unknown>, key: string) => T;
}

export interface ViewCompositionHelpers {
  view: Record<string, unknown>;
  select: <T>(obj: Record<string, unknown>, key: string) => T;
}

// --- Factory and Lattice Type Tags ---

/**
 * Type for a ModelFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type ModelFactory = ((
  dependency?: ModelDependency,
  callback?: (arg: ModelCompositionHelpers) => Record<string, unknown>
) => TwoPhaseEnforcementProxy<[ModelExtensionHelpers], ModelContract>) & {
  [MODEL_FACTORY_TYPE]: true;
};

/**
 * Type for a Lattice, tagged for type-level and runtime detection.
 */
export type Lattice = {
  [LATTICE_TYPE]: true;
  model: ModelContract;
  state: StateContract;
  actions: ActionsContract;
  view: ViewContract;
};

/**
 * Utility type: dependency for createModel must be a Lattice or ModelContract (result of extension phase).
 * The factory function itself and the proxy returned by calling a factory are NOT valid dependencies.
 */
export type ModelDependency = Lattice | ModelContract;

/**
 * Type for a StateFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type StateFactory = ((
  dependency?: StateDependency,
  callback?: (arg: StateCompositionHelpers) => Record<string, unknown>
) => TwoPhaseEnforcementProxy<[StateExtensionHelpers], StateContract>) & {
  [STATE_FACTORY_TYPE]: true;
};

/**
 * Type for an ActionsFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type ActionsFactory = ((
  dependency?: ActionsDependency,
  callback?: (arg: ActionsCompositionHelpers) => Record<string, unknown>
) => TwoPhaseEnforcementProxy<[ActionsExtensionHelpers], ActionsContract>) & {
  [ACTIONS_FACTORY_TYPE]: true;
};

/**
 * Type for a ViewFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type ViewFactory = ((
  dependency?: ViewDependency,
  callback?: (arg: ViewCompositionHelpers) => Record<string, unknown>
) => TwoPhaseEnforcementProxy<[ViewExtensionHelpers], ViewContract>) & {
  [VIEW_FACTORY_TYPE]: true;
};

/**
 * Utility type: dependency for createState must be a Lattice or StateContract (result of extension phase).
 */
export type StateDependency = Lattice | StateContract;

/**
 * Utility type: dependency for createActions must be a Lattice or ActionsContract (result of extension phase).
 */
export type ActionsDependency = Lattice | ActionsContract;

/**
 * Utility type: dependency for createView must be a Lattice or ViewContract (result of extension phase).
 */
export type ViewDependency = Lattice | ViewContract;
