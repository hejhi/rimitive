/**
 * @fileoverview Runtime types for the signals-based reactive slice system
 *
 * These types define the core interfaces for Lattice's signals-first reactive system.
 * They are used by both the runtime and adapters.
 */

/**
 * A signal is a read-only reactive primitive that can create signal selectors
 * Reading a signal automatically registers it as a dependency in tracking contexts
 * All updates must go through the set() function
 */
export interface Signal<T> {
  // Read value
  (): T;

  // Subscribe to changes
  subscribe: (listener: () => void) => () => void;

  // Create signal selector with predicate (for arrays)
  <U>(
    predicate: T extends (infer U)[]
      ? (item: U, index: number) => boolean
      : never
  ): T extends (infer U)[] ? SignalSelector<T, U> : never;

  // Create signal selector with predicate (for objects)
  <V>(
    predicate: T extends Record<string, infer V>
      ? (value: V, key: string) => boolean
      : never
  ): T extends Record<string, infer V> ? SignalSelector<T, V> : never;

  // Create signal selector with predicate (for Maps)
  <V>(
    predicate: T extends Map<any, infer V>
      ? (value: V, key: any) => boolean
      : never
  ): T extends Map<any, infer V> ? SignalSelector<T, V> : never;

  // Create signal selector with predicate (for Sets)
  <U>(
    predicate: T extends Set<infer U> ? (value: U) => boolean : never
  ): T extends Set<infer U> ? SignalSelector<T, U> : never;

  // Create keyed signal selector (for arrays)
  <K>(
    keyFn: T extends unknown[] ? (key: K) => K : never,
    predicate: T extends (infer U)[] ? (item: U, key: K) => boolean : never
  ): T extends (infer U)[] ? (key: K) => SignalSelector<T, U> : never;

  // Create keyed signal selector (for objects)
  <K>(
    keyFn: T extends Record<string, unknown> ? (key: K) => K : never,
    predicate: T extends Record<string, infer V>
      ? (value: V, key: K) => boolean
      : never
  ): T extends Record<string, infer V>
    ? (key: K) => SignalSelector<T, V>
    : never;
}

/**
 * A computed signal is read-only and derives its value from other signals
 * Dependencies are tracked automatically when the computation function runs
 */
export interface Computed<T> {
  (): T; // Read computed value
  subscribe: (listener: () => void) => () => void; // Subscribe to changes
}

/**
 * A signal selector is a computed value that queries items from a collection signal
 * It maintains a cached position for efficient re-reads and enables smart updates
 */
export interface SignalSelector<T, U> extends Computed<U | undefined> {
  _source: Signal<T>;
  _predicate: (
    value: T extends Array<infer E>
      ? E
      : T extends Set<infer E>
        ? E
        : T extends Map<infer K, infer V>
          ? [K, V]
          : T[keyof T],
    key?: number | string | symbol
  ) => boolean;
  _cachedIndex?: number | string | symbol; // Position/key in source
  _sourceVersion: number; // Version of source when cached
  _unsubscribeFromSource?: () => void; // Cleanup function
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
 * Function to update state through signals
 * All state updates must go through this function
 */
export interface SetState {
  // Batch update multiple signals at once
  <State extends Record<string, any>>(
    store: SignalState<State>,
    updates: Partial<State> | ((current: State) => Partial<State>)
  ): void;

  // Update signal/signal selector with function (for values that might be undefined)
  // Note: updater is only called if current value is not undefined
  <T>(
    signal: Signal<T | undefined> | SignalSelector<any, T>,
    updater: (current: T) => T
  ): void;

  // Update signal/signal selector with function
  <T>(
    signal: Signal<T> | SignalSelector<any, T>,
    updater: (current: T) => T
  ): void;

  // Partial updates for objects (for values that might be undefined)
  // Note: updates are only applied if current value is not undefined
  <T extends object>(
    signal: Signal<T | undefined> | SignalSelector<any, T>,
    updates: Partial<T>
  ): void;

  // Partial updates for objects
  <T extends object>(
    signal: Signal<T> | SignalSelector<any, T>,
    updates: Partial<T>
  ): void;

  // Set signal/signal selector value directly
  <T>(signal: Signal<T> | SignalSelector<any, T>, value: T): void;
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
  set: SetState;
}

/**
 * Component context includes state signals under 'store' and lattice utilities
 * This is what component factories receive as their single parameter
 */
export interface ComponentContext<State> extends LatticeContext {
  store: SignalState<State>;
}

/**
 * Component factory function that receives a merged context
 * Returns slices (signals, computeds, and methods)
 */
export type ComponentFactory<State> = (context: ComponentContext<State>) => any;

/**
 * Middleware receives the component context and can enhance/modify it
 */
export type ComponentMiddleware<State> = (
  context: ComponentContext<State>
) => ComponentContext<State>;

/**
 * Configuration for creating a store with optional middleware enhancement
 */
export interface StoreConfig<State> {
  state: State;
  enhancer?: (context: ComponentContext<State>) => ComponentContext<State>;
}
