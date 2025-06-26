/**
 * @fileoverview Runtime types for the signals-based reactive slice system
 * 
 * These types define the core interfaces for Lattice's signals-first reactive system.
 * They are used by both the runtime and adapters.
 */

/**
 * A signal is a reactive primitive that can be read and written
 * Reading a signal automatically registers it as a dependency in tracking contexts
 */
export interface Signal<T> {
  (): T;                                           // Read current value
  (value: T): void;                               // Write new value (if writable)
  subscribe: (listener: () => void) => () => void; // Subscribe to changes
}

/**
 * A computed signal is read-only and derives its value from other signals
 * Dependencies are tracked automatically when the computation function runs
 */
export interface Computed<T> extends Omit<Signal<T>, 'call'> {
  (): T;                                           // Read computed value
  subscribe: (listener: () => void) => () => void; // Subscribe to changes
}

/**
 * State represented as signals - each property is a reactive signal
 */
export type SignalState<State> = {
  [K in keyof State]: Signal<State[K]>;
};

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
 * Function to update state - supports both direct updates and computed updates
 */
export type SetState<State> = (updates: Partial<State> | ((state: SignalState<State>) => Partial<State>)) => void;

/**
 * Factory function for creating reactive slices using signals
 * Provides read-only signals and a set function for updates
 */
export type ReactiveSliceFactory<State> = <Computed>(
  computeFn: (state: SignalState<State>, set: SetState<State>) => Computed
) => SliceHandle<Computed>;

/**
 * Lattice context provides scoped signal/computed factories
 * Each component tree gets its own context to avoid global conflicts
 */
export interface LatticeContext<State = any> {
  signal: <T>(initialValue: T) => Signal<T>;
  computed: <T>(computeFn: () => T) => Computed<T>;
  set: SetState<State>;
}

/**
 * Component context includes state signals under 'store' and lattice utilities
 * This is what component factories receive as their single parameter
 */
export interface ComponentContext<State> extends LatticeContext<State> {
  store: SignalState<State>;
}

/**
 * Component factory function that receives a merged context
 * Returns slices (signals, computeds, and methods)
 */
export type ComponentFactory<State, Slices> = (
  context: ComponentContext<State>
) => Slices;

/**
 * Middleware receives the component context and can enhance/modify it
 */
export type ComponentMiddleware<State> = (
  context: ComponentContext<State>
) => ComponentContext<State>;


