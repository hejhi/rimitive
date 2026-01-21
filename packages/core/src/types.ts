/**
 * Core types for Rimitive module system
 *
 * @module
 */

import type { Module } from './module';

/**
 * Context provided to modules for lifecycle management.
 *
 * Passed to `init`, `destroy`, and `instrument` hooks.
 *
 * @example
 * ```ts
 * const MyModule = defineModule({
 *   name: 'myModule',
 *   create: () => createImpl(),
 *   init(ctx) {
 *     // Register cleanup
 *     ctx.destroy(() => cleanup());
 *   },
 * });
 * ```
 */
export type ServiceContext = {
  /**
   * Register a cleanup function to be called when context is disposed.
   * Multiple cleanup functions can be registered.
   */
  destroy(cleanup: () => void): void;

  /**
   * Check if the context has been disposed.
   * Useful for guarding operations in async callbacks.
   */
  readonly isDestroyed: boolean;
};

/**
 * Instrumentation context for debugging and profiling.
 *
 * Passed to the `instrument` hook of modules when instrumentation is enabled.
 *
 * @example
 * ```ts
 * const Signal = defineModule({
 *   name: 'signal',
 *   create: ({ graphEdges }) => (value) => createSignal(value, graphEdges),
 *   instrument(impl, instr) {
 *     return (value) => {
 *       const sig = impl(value);
 *       instr.register(sig, 'signal');
 *       return sig;
 *     };
 *   },
 * });
 * ```
 */
export type InstrumentationContext = {
  /**
   * Unique ID for this context instance
   */
  contextId: string;

  /**
   * Human-readable name of the context (for debugging)
   */
  contextName: string;

  /**
   * Emit an instrumentation event to all registered providers
   */
  emit(event: {
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
  }): void;

  /**
   * Register a resource for tracking.
   * Returns an object with a generated ID and the resource.
   */
  register<T>(
    resource: T,
    type: string,
    name?: string
  ): { id: string; resource: T };
};

/**
 * A callable returned by `compose()` that provides access to the module context.
 *
 * `Use` is both a function AND an object with all service properties:
 * - Call `use(fn)` to invoke a portable/behavior with the service context
 * - Access `use.signal`, `use.el`, etc. directly as properties
 *
 * When you call `use(fn)`, the callback receives the `Use` object itself,
 * allowing nested portables to call other portables.
 *
 * @example
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule);
 *
 * // Access services directly as properties
 * const count = svc.signal(0);
 * const doubled = svc.computed(() => count() * 2);
 *
 * // Or invoke a portable/behavior
 * const Counter = svc((ctx) => () => {
 *   const count = ctx.signal(0);
 *   return { value: count };
 * });
 *
 * // Inside a portable, you can do both:
 * const MyComponent = svc((ctx) => {
 *   // Call ctx() with another portable (ctx is also callable)
 *   const behavior = ctx(someBehavior);
 *
 *   // Access services directly
 *   const { signal, el } = ctx;
 *
 *   return () => { ... };
 * });
 * ```
 */
export type Use<TSvc> = {
  /** Invoke a portable/behavior - callback receives the Use object itself */
  <TResult>(fn: (svc: Use<TSvc>) => TResult): TResult;
} & TSvc;

/**
 * Utility type: Convert a union to an intersection.
 * Used internally to combine types.
 */
export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Extract the implementation type from a Module.
 */
export type ModuleImpl<T> =
  T extends Module<string, infer TImpl, unknown> ? TImpl : never;

/**
 * Extract the name from a Module.
 */
export type ModuleName<T> =
  T extends Module<infer TName, unknown, unknown> ? TName : never;

/**
 * Extract replacement modules from an overridden module.
 */
type ExtractReplacements<M> = M extends { __replacements: infer R }
  ? R extends readonly Module[]
    ? R[number]
    : never
  : never;

/**
 * Extract the deps object type from a module's deps.
 * The keys are module names, values are their impls.
 */
type ExtractDepsFromModule<M> =
  M extends Module<string, unknown, infer TDeps>
    ? TDeps extends Record<string, unknown>
      ? TDeps
      : never
    : never;

/**
 * Extract deps from all replacement modules and merge them.
 */
type ExtractReplacementDeps<M> = ExtractDepsFromModule<ExtractReplacements<M>>;

/**
 * Flatten a module and its replacements into a union of all modules.
 */
type FlattenModule<M> = M | ExtractReplacements<M>;

/**
 * Merge all replacement deps from a tuple of modules into a single object type.
 */
type AllReplacementDeps<TModules extends readonly Module[]> =
  UnionToIntersection<ExtractReplacementDeps<TModules[number]>>;

/**
 * The composed context type from a tuple of Modules.
 *
 * Maps module names to their implementations and adds a `dispose()` method.
 * For overridden modules, also includes the replacement modules' dependencies.
 *
 * @example
 * ```ts
 * type SignalModule = Module<'signal', SignalImpl, SignalDeps>;
 * type ComputedModule = Module<'computed', ComputedImpl, ComputedDeps>;
 *
 * type Ctx = ComposedContext<[SignalModule, ComputedModule]>;
 * // Ctx = { signal: SignalImpl; computed: ComputedImpl; dispose(): void }
 * ```
 *
 * @example With override
 * ```ts
 * const OverriddenService = override(Service, { logger: ConfigurableLogger });
 * type Ctx = ComposedContext<[typeof OverriddenService]>;
 * // Ctx includes 'service', 'logger', AND 'config' (from ConfigurableLogger's deps)
 * ```
 */
export type ComposedContext<TModules extends readonly Module[]> = {
  [M in FlattenModule<TModules[number]> as ModuleName<M>]: ModuleImpl<M>;
} & AllReplacementDeps<TModules> & {
    dispose(): void;
  };

// ============================================================================
// Compose validation
// ============================================================================

/** Module types that cannot be passed directly to compose() */
type Transient = { __scope: 'transient' };
type UnwrappedAsync = Module<string, Promise<unknown>, unknown> & {
  __lazy?: never;
};
type InvalidModule = Transient | UnwrappedAsync;

/** Error messages */
type TransientError =
  'Error: Transient modules cannot be passed directly to compose(). Use as dependency only.';
type AsyncError =
  'Error: Async create() requires lazy() wrapper. Use: lazy(YourAsyncModule)';

/** Get error message for an invalid module type */
type ErrorFor<T> = T extends Transient ? TransientError : AsyncError;

/** Check if T matches any invalid module type */
type IsInvalid<T> = [Extract<T, InvalidModule>] extends [never] ? false : true;

/** Validate a module: return T if valid, error message if not */
type Validated<T> = IsInvalid<T> extends true ? ErrorFor<T> : T;

/** Validate all modules in tuple */
export type ValidatedModules<T extends readonly Module[]> = {
  [K in keyof T]: Validated<T[K]>;
};

/** Check if array contains any lazy modules */
export type ContainsLazy<T extends readonly Module[]> =
  Extract<T[number], { __lazy: true }> extends never ? false : true;

/** Return type: Promise if lazy modules present */
export type ComposeReturn<T extends readonly Module[]> =
  ContainsLazy<T> extends true
    ? Promise<Use<ComposedContext<T>>>
    : Use<ComposedContext<T>>;
