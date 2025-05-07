// --- Lattice Core Types: Two-Phase Contract Enforcement ---
// See: docs/draft-spec.md (Composition and Extension Function Pattern)

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
export type TwoPhaseEnforcementProxy<Args extends unknown[], Result> = {
  (...args: Args): Result;
  // Any property access is illegal and will throw at runtime (enforced by Proxy)
};

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

// --- Example: Model Factory Types ---
// These are illustrative; actual model/state/actions/view contracts are defined elsewhere.

// export type ModelFactory = TwoPhaseFactory<
//   [/* composition args */],
//   [/* extension args */],
//   /* result type */
// >;

// --- Factory and Lattice Type Tags ---

/** Unique symbol to tag model factories at runtime and type level */
export const MODEL_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.ModelFactory'
);

/** Unique symbol to tag lattice objects at runtime and type level */
export const LATTICE_TYPE: unique symbol = Symbol.for('Lattice.Lattice');

/**
 * Type for a ModelFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type ModelFactory = ((
  dependency?: ModelDependency
) => TwoPhaseEnforcementProxy<unknown[], never>) & {
  [MODEL_FACTORY_TYPE]: true;
};

/**
 * Type for a Lattice, tagged for type-level and runtime detection.
 */
export type Lattice = { [LATTICE_TYPE]: true };

/**
 * Utility type: dependency for createModel must be a Lattice or ModelFactory.
 * The proxy returned by calling a factory is NOT a valid dependency.
 */
export type ModelDependency = Lattice | ModelFactory;

/** Unique symbol to tag state factories at runtime and type level */
export const STATE_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.StateFactory'
);

/** Unique symbol to tag actions factories at runtime and type level */
export const ACTIONS_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.ActionsFactory'
);

/** Unique symbol to tag view factories at runtime and type level */
export const VIEW_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.ViewFactory'
);

/**
 * Type for a StateFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type StateFactory = ((
  dependency?: StateDependency
) => TwoPhaseEnforcementProxy<unknown[], never>) & {
  [STATE_FACTORY_TYPE]: true;
};

/**
 * Type for an ActionsFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type ActionsFactory = ((
  dependency?: ActionsDependency
) => TwoPhaseEnforcementProxy<unknown[], never>) & {
  [ACTIONS_FACTORY_TYPE]: true;
};

/**
 * Type for a ViewFactory, tagged for type-level and runtime detection.
 * This is the factory function itself, NOT the proxy returned by calling it.
 */
export type ViewFactory = ((
  dependency?: ViewDependency
) => TwoPhaseEnforcementProxy<unknown[], never>) & {
  [VIEW_FACTORY_TYPE]: true;
};

/**
 * Utility type: dependency for createState must be a Lattice or StateFactory.
 */
export type StateDependency = Lattice | StateFactory;

/**
 * Utility type: dependency for createActions must be a Lattice or ActionsFactory.
 */
export type ActionsDependency = Lattice | ActionsFactory;

/**
 * Utility type: dependency for createView must be a Lattice or ViewFactory.
 */
export type ViewDependency = Lattice | ViewFactory;

// --- Runtime Guards ---
export function isModelFactory(obj: unknown): obj is ModelFactory {
  return Boolean(
    obj &&
      typeof obj === 'function' &&
      (obj as any)[MODEL_FACTORY_TYPE] === true
  );
}

export function isLattice(obj: unknown): obj is Lattice {
  return Boolean(
    obj && typeof obj === 'object' && (obj as any)[LATTICE_TYPE] === true
  );
}

export function isStateFactory(obj: unknown): obj is StateFactory {
  return Boolean(
    obj &&
      typeof obj === 'function' &&
      (obj as any)[STATE_FACTORY_TYPE] === true
  );
}

export function isActionsFactory(obj: unknown): obj is ActionsFactory {
  return Boolean(
    obj &&
      typeof obj === 'function' &&
      (obj as any)[ACTIONS_FACTORY_TYPE] === true
  );
}

export function isViewFactory(obj: unknown): obj is ViewFactory {
  return Boolean(
    obj && typeof obj === 'function' && (obj as any)[VIEW_FACTORY_TYPE] === true
  );
}

// --- Utility Types ---
// Add more as the contract surface is refined.
