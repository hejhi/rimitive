/**
 * @fileoverview Runtime types for Lattice core
 *
 * These types define the core interfaces for Lattice's signals-based reactive system.
 */

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
  peek(): T;

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
  peek(): T; // Read value without reactive tracking

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
 * Lattice context provides scoped signal/computed factories
 * Each component tree gets its own context to avoid global conflicts
 */
export interface LatticeContext {
  signal: <T>(initialValue: T, name?: string) => Signal<T>;
  computed: <T>(computeFn: () => T) => Computed<T>;
  effect: (effectFn: () => void | (() => void)) => () => void;
  batch: (fn: () => void) => void;
  dispose(): void;
}

export interface StoreConfig<State> {
  state: State;
}

// Re-export store type from store module
export type { Store } from './store';
