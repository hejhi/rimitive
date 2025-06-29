/**
 * @fileoverview Runtime types for the signals-based reactive slice system
 *
 * These types define the core interfaces for Lattice's signals-first reactive system.
 * They are used by both the runtime and adapters.
 */


/**
 * A signal is a read-only reactive primitive that can create derived signals
 * Reading a signal automatically registers it as a dependency in tracking contexts
 * All updates must go through the set() function
 */
export interface Signal<T> {
  // Read value
  (): T;
  
  // Subscribe to changes
  subscribe: (listener: () => void) => () => void;
  
  // Create derived signal with predicate (for arrays)
  <U>(predicate: T extends (infer U)[] ? (item: U, index: number) => boolean : never): T extends (infer U)[] ? Signal<U | undefined> : never;
  
  // Create derived signal with predicate (for objects)
  <V>(predicate: T extends Record<string, infer V> ? (value: V, key: string) => boolean : never): T extends Record<string, infer V> ? Signal<V | undefined> : never;
  
  // Create derived signal with predicate (for Maps)
  <V>(predicate: T extends Map<any, infer V> ? (value: V, key: any) => boolean : never): T extends Map<any, infer V> ? Signal<V | undefined> : never;
  
  // Create derived signal with predicate (for Sets)
  <U>(predicate: T extends Set<infer U> ? (value: U) => boolean : never): T extends Set<infer U> ? Signal<U | undefined> : never;
  
  // Create keyed selector (for arrays)
  <K, U>(
    keyFn: T extends (infer U)[] ? (key: K) => K : never,
    predicate: T extends (infer U)[] ? (item: U, key: K) => boolean : never
  ): T extends (infer U)[] ? (key: K) => Signal<U | undefined> : never;
  
  // Create keyed selector (for objects)
  <K, V>(
    keyFn: T extends Record<string, infer V> ? (key: K) => K : never,
    predicate: T extends Record<string, infer V> ? (value: V, key: K) => boolean : never
  ): T extends Record<string, infer V> ? (key: K) => Signal<V | undefined> : never;
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
export type SetState<State> = {
  // Set signal value directly
  <T>(signal: Signal<T>, value: T): void;
  
  // Update signal with function
  <T>(signal: Signal<T>, updater: (current: T) => T): void;
  
  // Partial updates for objects
  <T extends object>(signal: Signal<T>, updates: Partial<T>): void;
};

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
