import { StoreApi, UseBoundStore } from 'zustand';

// Utility type to prevent TypeScript from inferring types in certain positions
export type NoInfer<T> = [T][T extends any ? 0 : never];

// ---- Hooks System Types ----

/**
 * Interface for the hooks system
 */
export interface HooksInterface {
  before: (method: string, callback: Function) => void;
  after: (method: string, callback: Function) => void;
}

/**
 * The hooks system for intercepting API method calls
 */
export interface HooksSystem extends HooksInterface {
  _beforeHooks: Record<string, Function[]>;
  _afterHooks: Record<string, Function[]>;
  remove: (
    type: 'before' | 'after',
    method: string,
    callback: Function
  ) => void;
  executeBefore: (method: string, ...args: unknown[]) => unknown;
  executeAfter: (
    method: string,
    result: unknown,
    ...args: unknown[]
  ) => unknown;
}

/**
 * Store with hooks system
 */
export type StoreWithHooks<T> = T & { _hooks: HooksSystem };

/**
 * Enhanced API type that combines the Zustand store API with direct method access
 * This type allows accessing methods and properties directly from the API object
 * without having to call .getState() first.
 */
export type DirectAccessAPI<T> = UseBoundStore<StoreApi<StoreWithHooks<T>>> & T;

// ---- Props System Types ----

/**
 * Strongly typed base props getter function that accepts parameters
 * This is important for withProps to correctly infer types and pass
 * parameters from the component to the base props
 */
export type ForceTypedGetBaseProps<P, R> = (params?: P) => R;

/**
 * Get function with proper typing based on whether params is required
 * Modified to be more flexible for test environments
 */
export type PropsGetFn<P, R> = P extends undefined
  ? () => R
  : unknown extends P
    ? (params?: any) => R
    : (params: P) => R;

/**
 * Interface for a props store state
 */
export interface PropsState<P, R> {
  partName: string;
  get: PropsGetFn<P, R>;
}

/**
 * Type for a props store with partName metadata
 */
export type PropsStore<P, R> = StoreApi<PropsState<P, R>> & {
  partName: string;
};

// Type augmentation for tests
declare global {
  interface Window {
    __LATTICE_TEST_MODE__?: boolean;
  }
}

/**
 * Function signature for standard props config creators
 * Follows a middleware-friendly pattern inspired by Zustand
 */
export type PropsFn<P, R> = (
  set: StoreApi<PropsState<P, R>>['setState'],
  get: StoreApi<PropsState<P, R>>['getState'],
  store: StoreApi<PropsState<P, R>>
) => {
  get: PropsGetFn<P, R>;
};

/**
 * State creator function that is compatible with Zustand's middleware pattern
 */
export type StateCreator<P, R> = (
  set: StoreApi<PropsState<P, R>>['setState'],
  get: StoreApi<PropsState<P, R>>['getState'],
  store: StoreApi<PropsState<P, R>>
) => PropsState<P, R>;

/**
 * Enhanced store type with base props access
 */
export type StoreWithBaseProps<P, R> = StoreApi<PropsState<P, R>> & {
  getBaseProps: ForceTypedGetBaseProps<P, R>;
};

/**
 * State creator type for functions that use enhanced store with base props
 */
export type StateCreatorWithBaseProps<P, R> = (
  set: StoreApi<PropsState<P, R>>['setState'],
  get: StoreApi<PropsState<P, R>>['getState'],
  store: StoreWithBaseProps<P, R>
) => {
  get: P extends undefined ? () => R : (params: P) => R;
};

/**
 * Type helper for inferring the return type of a function
 */
export type InferReturnType<T> = T extends (...args: any[]) => infer R
  ? R
  : never;

/**
 * Type for a props configuration with get function to support return type inference
 */
export type PropsConfig<P, G extends (params: P) => any> = {
  get: G;
};

/**
 * Type for a function that creates a props configuration with get function
 */
export type PropsConfigCreator<P, G extends (params: P) => any> = (
  set: StoreApi<PropsState<P, InferReturnType<G>>>['setState'],
  get: StoreApi<PropsState<P, InferReturnType<G>>>['getState'],
  store: StoreWithBaseProps<P, InferReturnType<G>>
) => PropsConfig<P, G>;

/**
 * Type for withProps middleware that properly preserves parameter types
 * and supports return type inference
 */
export interface WithPropsMW {
  // Original version with explicit types
  <L extends LatticeWithProps>(
    baseLattice: L
  ): <P = any, R = any>(fn: StateCreatorWithBaseProps<P, R>) => PropsFn<P, R>;

  // R-only version where P is specified inline in the get function
  <L extends LatticeWithProps>(
    baseLattice: L
  ): <R>(
    fn: (
      set: StoreApi<PropsState<any, R>>['setState'],
      get: StoreApi<PropsState<any, R>>['getState'],
      store: StoreWithBaseProps<any, R>
    ) => {
      get: (params?: any) => R;
    }
  ) => PropsFn<any, R>;

  // Enhanced version that infers return type from the get function
  <L extends LatticeWithProps>(
    baseLattice: L
  ): <P = any, G extends (params: P) => any = (params: P) => any>(
    fn: PropsConfigCreator<P, G>
  ) => PropsFn<P, InferReturnType<G>>;
}

/**
 * Type helper for better inference when spreading objects
 */
export type Spread<A, B> = Omit<A, keyof B> & B;

// ---- Lattice Types ----

/**
 * Type for a lattice with props
 */
export interface LatticeWithProps {
  props: Record<string, PropsStore<any, any>>;
  name: string;
}

/**
 * Lattice object interface
 */
export interface Lattice<T> {
  name: string;
  api: DirectAccessAPI<T>;
  hooks: HooksInterface;
  props: Record<string, PropsStore<any, any>>;
  use: <U>(plugin: (lattice: Lattice<T>) => Lattice<T & U>) => Lattice<T & U>;
}

/**
 * Lattice configuration object
 */
export type LatticeConfig<T> = Partial<Omit<Lattice<T>, 'name'>>;

/**
 * Helper type for creating lattice composers with proper typing
 *
 * @example
 * const createCounter = (): LatticeComposer<BaseState, CounterState> => {
 *   return (baseLattice) => {
 *     // Implementation...
 *   };
 * };
 */
export type LatticeComposer<Base, Enhanced> = <T extends Base>(
  baseLattice: Lattice<T>
) => Lattice<T & Enhanced>;

// ---- Store Sync Types ----

/**
 * Type for a state object that includes sync cleanup functionality
 */
export interface SyncedState {
  _syncCleanup: () => void;
}
