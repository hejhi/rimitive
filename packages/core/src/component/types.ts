/**
 * @fileoverview Runtime types for the signals-based reactive slice system
 *
 * These types define the core interfaces for Lattice's signals-first reactive system.
 * They are used by both the runtime and adapters.
 */

import { Store } from '../store';

/**
 * A selected value derived from a signal or computed
 */
export interface Selected<T> {
  readonly value: T;
  subscribe(listener: () => void): () => void;
  // Allow chaining selects
  select<R>(selector: (value: T) => R): Selected<R>;
}

/**
 * A signal is a reactive primitive that holds a value
 * Reading a signal automatically registers it as a dependency in tracking contexts
 * Can be updated directly via .value = newValue or through the set() function
 */
export interface Signal<T> {
  // Read/write value
  value: T;

  // Subscribe to changes
  subscribe: (listener: () => void) => () => void;

  // Create a fine-grained subscription to a selected value
  select<R>(selector: (value: T) => R): Selected<R>;

  // Object/array update methods
  set<K extends keyof T>(key: K, value: T[K]): void;
  patch<K extends keyof T>(
    key: K,
    partial: T[K] extends object ? Partial<T[K]> : never
  ): void;
}

/**
 * A computed signal is read-only and derives its value from other signals
 * Dependencies are tracked automatically when the computation function runs
 */
export interface Computed<T> {
  readonly value: T; // Read computed value
  subscribe: (listener: () => void) => () => void; // Subscribe to changes

  // Create a fine-grained subscription to a selected value
  select<R>(selector: (value: T) => R): Selected<R>;
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
 * Function to batch update state through signals
 * Updates multiple signals atomically within a single batch
 */
export interface SetState {
  <State>(
    store: SignalState<State>,
    updates: Partial<State> | ((current: State) => Partial<State>)
  ): void;
}

/**
 * Factory function for creating reactive slices using signals
 * Provides read-only signals and a set function for updates
 */
export type ReactiveSliceFactory<State> = <Computed>(
  computeFn: (state: SignalState<State>, set: SetState) => Computed
) => SliceHandle<Computed>;

/**
 * Lattice context provides scoped signal/computed factories
 * Each component tree gets its own context to avoid global conflicts
 */
export interface LatticeContext {
  signal: <T>(initialValue: T) => Signal<T>;
  computed: <T>(computeFn: () => T) => Computed<T>;
  effect: (effectFn: () => void | (() => void)) => () => void;
  batch: (fn: () => void) => void;
  dispose(): void;
}

export interface StoreConfig<State> {
  state: State;
}

export type Component<TState extends object, TReturn> = (
  store: Store<TState>
) => TReturn;
