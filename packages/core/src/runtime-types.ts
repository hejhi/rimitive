/**
 * @fileoverview Runtime types for the reactive slice system
 * 
 * These types define the core interfaces for Lattice's reactive system.
 * They are used by both the runtime and adapters.
 */

/**
 * A selector provides access to a single state value with subscription capabilities
 */
export type Selector<T> = {
  (): T;
  subscribe: (listener: () => void) => () => void;
  _dependencies: Set<string>;
};

/**
 * Collection of selectors for each state property
 */
export type Selectors<State> = {
  [K in keyof State]: Selector<State[K]>;
};

/**
 * Function to update state with all selectors provided automatically
 */
export type SetState<State> = (
  updateFn: (selectors: Selectors<State>) => Partial<State>
) => void;

/**
 * A handle to a reactive slice that provides dual functionality:
 * 
 * 1. When called with no arguments, returns the computed values and methods
 * 2. When called with a selector function, extracts values for composition with other slices
 */
export interface SliceHandle<Computed> {
  (): Computed;
  <ChildDeps>(depsFn: (parent: Computed) => ChildDeps): ChildDeps;
}

/**
 * Factory function for creating reactive slices
 */
export type ReactiveSliceFactory<State> = <Deps, Computed>(
  depsFn: (selectors: Selectors<State>) => Deps,
  computeFn: (deps: Deps, set: SetState<State>) => Computed
) => SliceHandle<Computed>;