import { StoreApi, UseBoundStore } from 'zustand';

/**
 * Core Zustand Types
 */
export type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean
) => void;
export type GetState<T> = () => T;
export type Subscribe<T> = (
  listener: (state: T, prevState: T) => void
) => () => void;

export type StateCreator<T> = (
  set: SetState<T>,
  get: GetState<T>,
  api: StoreApi<T>
) => T;

/**
 * API Types
 */
// Core method value types
export type MethodParams = unknown[];
export type MethodReturnType = unknown;

// Base type for all API methods
export interface MethodDefinition<
  TParams extends MethodParams = MethodParams,
  TReturn = MethodReturnType,
> {
  (...args: TParams): TReturn;
}

// Type-safe API methods record
export type ApiMethods = Record<string, MethodDefinition | unknown>;

// Separate state from methods
export type ExtractState<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

export type ExtractMethods<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

// Hook types
/**
 * Hook that runs before an API method is executed.
 *
 * @param args - The arguments passed to the original method
 * @returns If the hook returns `false`, the original method and any remaining hooks will not be executed.
 *          If it returns `void` or any other value, execution continues normally.
 */
export type BeforeHook<TParams extends MethodParams = MethodParams> = (
  ...args: TParams
) => boolean | void;

/**
 * Hook that runs after an API method is executed.
 *
 * @param result - The return value from the original method
 * @param args - The arguments passed to the original method
 */
export type AfterHook<
  TReturn = MethodReturnType,
  TParams extends MethodParams = MethodParams,
> = (result: TReturn, ...args: TParams) => void;

// Strongly typed hook system
export interface HookSystem {
  before<TParams extends MethodParams = MethodParams>(
    methodName: string,
    hook: BeforeHook<TParams>
  ): ReactiveApi;

  after<
    TReturn = MethodReturnType,
    TParams extends MethodParams = MethodParams,
  >(
    methodName: string,
    hook: AfterHook<TReturn, TParams>
  ): ReactiveApi;
}

// Type for auto-generated hooks in the use property
export interface ReactiveHooks {
  // For state values: returns the current value
  // For functions: returns the memoized function
  [key: string]: <TReturn = unknown>(params?: unknown) => TReturn;
}

// Reactive API with React hooks - base interface without index signature
export interface ReactiveApiBase {
  // Auto-generated hooks for React
  use: ReactiveHooks;
}

// Reactive API - can be extended with specific properties
export interface ReactiveApi extends ReactiveApiBase {
  // This allows for additional properties while maintaining specific types
  [key: string]: unknown;
}

// Type helper to create a strongly-typed API from a specific interface
export type StronglyTypedAPI<T extends ApiMethods> = ReactiveApiBase & {
  [K in keyof T]: T[K];
};

/**
 * Props Types
 */
// For HTML/DOM attributes and ARIA properties
export type DOMAttributes = {
  [key: string]: string | number | boolean | undefined | null | (() => void);
};

export type Props = DOMAttributes;
export type PropsParams = Record<string, unknown>;
export type PropsFactory = (params: PropsParams) => Props;
export type PropsStore = UseBoundStore<StoreApi<PropsFactory>>;

export type PropsSystem = {
  [partName: string]: PropsStore;
};

/**
 * Lattice Types
 */
export interface Lattice {
  api: ReactiveApi;
  hooks: HookSystem;
  props: PropsSystem;
}

export interface LatticeWithPlugins<T extends Lattice = Lattice>
  extends Lattice {
  api: T['api'];
  hooks: T['hooks'];
  props: T['props'];
  use: <P extends TypedPlugin<T, Lattice>>(
    plugin: P
  ) => LatticeWithPlugins<PluginResult<T, P>>;
}

/**
 * Factory Function Types
 */
export interface CreateApiResult<TApi extends ApiMethods> {
  api: StronglyTypedAPI<TApi>;
  hooks: HookSystem;
}

export interface CreateLatticeOptions {
  api: ReactiveApi;
  hooks: HookSystem;
  props: PropsSystem;
}

// Helper for merging props
export type MergePropsFunction = (propsList: PropsStore[]) => PropsStore;

export interface MergePropsHelper {
  (propsList: PropsStore[]): PropsStore;
}

/**
 * Type Helpers
 */

// Generic type-safe factory functions with inference
/**
 * Interface for creating a reactive API with hooks.
 *
 * Following the pattern in the spec:
 * ```ts
 * const { api: treeAPI, hooks: treeHooks } = createAPI(dependencies, (set, get) => ({
 *   // Getters and setters...
 * }));
 * ```
 */
export interface CreateAPI {
  <TDependencies extends Record<string, unknown>, TApi extends ApiMethods>(
    dependencies: TDependencies,
    factory: (
      set: SetState<ExtractState<TApi>>,
      get: GetState<ExtractState<TApi>>
    ) => TApi
  ): CreateApiResult<TApi>;
}

// TypeSafe store getter function for props
export type StoreGetter = () => Record<string, unknown>;

// Helper type for merged APIs - combines all APIs into a flat object
export type MergedAPIs<T extends Record<string, ReactiveApi | StoreGetter>> = {
  [K in keyof T]: T[K] extends ReactiveApi
    ? T[K] extends { getState: () => infer S }
      ? S
      : never
    : T[K] extends () => infer R
      ? R
      : never;
};

// The merged result is a flattened object of all API state and getter results
export type FlattenedAPIs<T> =
  T extends Record<string, infer V>
    ? V extends Record<string, unknown>
      ? { [K in keyof V]: V[K] }
      : never
    : never;

export interface CreateProps {
  <TDependencies extends Record<string, ReactiveApi | StoreGetter>>(
    namespace: string,
    dependencies: TDependencies,
    factory: (
      get: () => FlattenedAPIs<MergedAPIs<TDependencies>>,
      params: PropsParams
    ) => Props
  ): PropsStore;
}

export interface CreateLattice {
  (namespace: string, options: CreateLatticeOptions): LatticeWithPlugins;
}

// Type-safe plugin composition
export interface TypedPlugin<
  TInput extends Lattice = Lattice,
  TOutput extends Lattice = Lattice,
> {
  (baseLattice: TInput): TOutput;
}

// Helper for type inference with plugins
export type EnhancedLattice<Plugin extends TypedPlugin<Lattice, Lattice>> =
  Plugin extends TypedPlugin<Lattice, infer Result> ? Result : Lattice;

// Type for plugin result inference
export type PluginResult<
  TBase extends Lattice,
  P extends TypedPlugin<TBase, Lattice>,
> = P extends TypedPlugin<TBase, infer Result> ? Result : TBase;
