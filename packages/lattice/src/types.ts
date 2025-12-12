/**
 * Core types for Lattice module system
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
 * import { compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule } from '@lattice/signals/extend';
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
export type ModuleImpl<T> = T extends Module<string, infer TImpl, unknown>
  ? TImpl
  : never;

/**
 * Extract the name from a Module.
 */
export type ModuleName<T> = T extends Module<infer TName, unknown, unknown>
  ? TName
  : never;

/**
 * The composed context type from a tuple of Modules.
 *
 * Maps module names to their implementations and adds a `dispose()` method.
 *
 * @example
 * ```ts
 * type SignalModule = Module<'signal', SignalImpl, SignalDeps>;
 * type ComputedModule = Module<'computed', ComputedImpl, ComputedDeps>;
 *
 * type Ctx = ComposedContext<[SignalModule, ComputedModule]>;
 * // Ctx = { signal: SignalImpl; computed: ComputedImpl; dispose(): void }
 * ```
 */
export type ComposedContext<TModules extends readonly Module[]> = {
  [M in TModules[number] as ModuleName<M>]: ModuleImpl<M>;
} & {
  dispose(): void;
};
