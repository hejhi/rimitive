/**
 * @fileoverview Runtime types for the signals-based reactive slice system
 *
 * These types define the core interfaces for Lattice's signals-first reactive system.
 * They are used by both the runtime and adapters.
 */


/**
 * A signal is a reactive primitive that can be read and written
 * Reading a signal automatically registers it as a dependency in tracking contexts
 * Supports smart updates for collections
 */
export interface Signal<T> {
  // ==== Core Operations ====
  (): T;
  (value: T): void;
  subscribe: (listener: () => void) => () => void;
  
  // ==== Array Operations ====
  // Find item matching predicate
  (predicate: T extends (infer U)[] ? (item: U, index: number) => boolean : never): T extends (infer U)[] ? U | undefined : never;
  
  // ==== Object Operations ====
  // Update property by key
  <K extends keyof T>(key: K, update: (value: T[K]) => T[K]): void;
  // Find property matching predicate
  (predicate: T extends Record<string, infer U> ? (value: U, key: string) => boolean : never): T extends Record<string, infer U> ? U | undefined : never;
  
  // ==== Map Operations ====
  // Update value by key
  (key: T extends Map<infer K, any> ? K : never,
   update: T extends Map<any, infer V> ? (value: V) => V : never): void;
  // Find entry matching predicate
  (predicate: T extends Map<any, infer V> ? (value: V, key: any) => boolean : never): T extends Map<any, infer V> ? V | undefined : never;
  
  // ==== Set Operations ====
  // Add single item
  (value: T extends Set<infer U> ? U : never): void;
  // Commands: add, toggle
  (command: T extends Set<any> ? 'add' | 'toggle' : never,
   value: T extends Set<infer U> ? U : never): void;
  // Command: delete by predicate
  (command: T extends Set<any> ? 'delete' : never,
   predicate: T extends Set<infer U> ? (value: U) => boolean : never): void;
  // Find item matching predicate
  (predicate: T extends Set<infer U> ? (value: U) => boolean : never): T extends Set<infer U> ? U | undefined : never;
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
 * Function to update state - supports both direct updates and computed updates
 * The function callback receives dereferenced state values for safety and performance
 */
export type SetState<State> = {
  // Original signature
  (updates: Partial<State> | ((state: State) => Partial<State>)): void;
  // Selector-based update
  <T>(selector: import('./selector-types').SelectorResult<T>, updates: Partial<T> | ((value: T) => Partial<T>)): void;
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
  select: <TArgs extends any[], TResult>(
    selectorFn: (...args: TArgs) => TResult | undefined
  ) => (...args: TArgs) => import('./selector-types').SelectorResult<TResult>;
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
