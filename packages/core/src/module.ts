/**
 * Module system for Rimitive
 *
 * Modules are the fundamental unit of composition in Rimitive. They declare
 * dependencies on other modules and provide an implementation.
 *
 * Think of modules like npm packages:
 * - package.json "dependencies" → Module declares what it requires
 * - npm install / node_modules → compose() resolves the graph
 * - import X from 'x' → deps are available by name
 *
 * @example
 * ```ts
 * import { defineModule, compose } from '@rimitive/core';
 *
 * // Define a module with no dependencies
 * const Logger = defineModule({
 *   name: 'logger',
 *   create: () => ({
 *     log: (msg: string) => console.log(msg),
 *   }),
 * });
 *
 * // Define a module that depends on Logger
 * const Counter = defineModule({
 *   name: 'counter',
 *   dependencies: [Logger],
 *   create: ({ logger }) => {
 *     let count = 0;
 *     return {
 *       increment: () => {
 *         count++;
 *         logger.log(`Count: ${count}`);
 *       },
 *     };
 *   },
 * });
 *
 * // Compose modules - dependencies are auto-resolved
 * const { counter, logger } = compose(Counter);
 * counter.increment(); // logs: "Count: 1"
 * ```
 *
 * @module
 */

import type { InstrumentationContext, ServiceContext } from './types';

/**
 * Status constant for module type discrimination
 */
export const STATUS_MODULE = 8; // 1000

/**
 * Module scope - controls instance lifetime
 * - 'singleton': One instance shared by all dependents (default)
 * - 'transient': Fresh instance for each dependent
 */
export type ModuleScope = 'singleton' | 'transient';

export interface AnyModule {
  status: typeof STATUS_MODULE;
  name: string;
  /** @internal */
  __scope?: ModuleScope;
  dependencies: AnyModule[];
  create(deps: unknown): unknown;
  instrument?(
    impl: unknown,
    instrumentation: InstrumentationContext,
    ctx: ServiceContext
  ): unknown;
  init?(ctx: ServiceContext): void;
  destroy?(ctx: ServiceContext): void;
}

/**
 * A module definition - the unit of composition in Rimitive.
 *
 * Modules declare their dependencies and provide a create function
 * that receives resolved dependencies and returns the implementation.
 */
export interface Module<
  TName extends string = string,
  TImpl = unknown,
  TDeps = unknown,
> {
  /** Status marker for runtime type discrimination */
  status: typeof STATUS_MODULE;

  /** Unique name - becomes the property name on the composed context */
  name: TName;

  /** @internal Instance scope - 'singleton' (default) or 'transient' */
  __scope?: ModuleScope;

  /** Modules this module depends on (resolved by compose) */
  dependencies: AnyModule[];

  /** Create the implementation with resolved dependencies */
  create(deps: TDeps): TImpl;

  /** Optional: wrap impl for debugging/profiling when instrumentation is enabled */
  instrument?(
    impl: TImpl,
    instrumentation: InstrumentationContext,
    ctx: ServiceContext
  ): TImpl;

  /** Optional: called when module is added to context */
  init?(ctx: ServiceContext): void;

  /** Optional: called when context is disposed */
  destroy?(ctx: ServiceContext): void;
}

/**
 * Helper type to extract the implementation type from a Module
 */
export type ModuleImpl<T> =
  T extends Module<string, infer TImpl, unknown> ? TImpl : never;

/**
 * Helper type to extract the name from a Module
 */
export type ModuleName<T> =
  T extends Module<infer TName, unknown, unknown> ? TName : never;

/**
 * Helper type to extract the deps type from a Module
 */
export type ModuleDeps<T> =
  T extends Module<string, unknown, infer TDeps> ? TDeps : never;

/**
 * Convert a tuple of modules to an object type with module names as keys
 * and implementations as values.
 *
 * @example
 * ```ts
 * type Deps = DepsFromModules<[typeof LoggerModule, typeof DatabaseModule]>;
 * // { logger: LoggerImpl, database: DatabaseImpl }
 * ```
 */
export type DepsFromModules<T extends readonly AnyModule[]> =
  T extends readonly []
    ? Record<string, never>
    : { [M in T[number] as ModuleName<M>]: ModuleImpl<M> };

/**
 * Input type for defineModule - same as Module but without status
 * and with optional dependencies.
 *
 * The TModules type parameter captures the dependencies tuple, allowing
 * TypeScript to infer the correct types for the create function's deps parameter.
 */
export interface ModuleDefinition<
  TName extends string,
  TImpl,
  TModules extends readonly AnyModule[] = readonly [],
> {
  /** Unique name - becomes the property name on the composed context */
  name: TName;

  /** Modules this module depends on (resolved by compose) */
  dependencies?: TModules;

  /** Create the implementation with resolved dependencies */
  create(deps: DepsFromModules<TModules>): TImpl;

  /** Optional: wrap impl for debugging/profiling when instrumentation is enabled */
  instrument?(
    impl: TImpl,
    instrumentation: InstrumentationContext,
    ctx: ServiceContext
  ): TImpl;

  /** Optional: called when module is added to context */
  init?(ctx: ServiceContext): void;

  /** Optional: called when context is disposed */
  destroy?(ctx: ServiceContext): void;
}

/**
 * Check if a value is a Module
 */
export function isModule(value: unknown): value is Module {
  return (
    value !== null &&
    typeof value === 'object' &&
    'status' in value &&
    value.status === STATUS_MODULE
  );
}

/**
 * Define a module - the fundamental building block of Rimitive composition.
 *
 * Modules declare dependencies on other modules and provide a create function
 * that receives resolved dependencies and returns the implementation.
 *
 * @example Basic module (no dependencies)
 * ```ts
 * const Logger = defineModule({
 *   name: 'logger',
 *   create: () => ({
 *     log: (msg: string) => console.log(msg),
 *   }),
 * });
 * ```
 *
 * @example Module with dependencies
 * ```ts
 * const UserService = defineModule({
 *   name: 'userService',
 *   dependencies: [Database, Logger],
 *   create: ({ database, logger }) => ({
 *     getUser: (id: string) => {
 *       logger.log(`Fetching user ${id}`);
 *       return database.query(`SELECT * FROM users WHERE id = ?`, [id]);
 *     },
 *   }),
 * });
 * ```
 *
 * @example Module with instrumentation
 * ```ts
 * const Signal = defineModule({
 *   name: 'signal',
 *   dependencies: [GraphEdges, Scheduler],
 *   create: ({ graphEdges, scheduler }) => (initialValue) => {
 *     // ... signal implementation
 *   },
 *   instrument: (impl, instr) => (initialValue) => {
 *     const sig = impl(initialValue);
 *     instr.register(sig, 'signal');
 *     return sig;
 *   },
 * });
 * ```
 */
export function defineModule<
  const TName extends string,
  TImpl,
  const TModules extends readonly AnyModule[] = readonly [],
>(
  definition: ModuleDefinition<TName, TImpl, TModules>
): Module<TName, TImpl, DepsFromModules<TModules>> {
  return {
    status: STATUS_MODULE,
    name: definition.name,
    dependencies: (definition.dependencies ?? []) as AnyModule[],
    create: definition.create as (deps: DepsFromModules<TModules>) => TImpl,
    ...(definition.instrument && { instrument: definition.instrument }),
    ...(definition.init && { init: definition.init }),
    ...(definition.destroy && { destroy: definition.destroy }),
  };
}

/**
 * Mark a module as transient - each dependent gets a fresh instance.
 *
 * By default, modules are singletons: one instance shared by all dependents.
 * Transient modules create a new instance for each module that depends on them.
 *
 * Transient modules cannot be passed directly to compose() - they are only
 * available as injected dependencies.
 *
 * @example
 * ```ts
 * const Logger = defineModule({
 *   name: 'logger',
 *   create: () => new Logger(),
 * });
 *
 * // Each dependent gets its own Logger instance
 * const TransientLogger = transient(Logger);
 *
 * const ServiceA = defineModule({
 *   name: 'serviceA',
 *   dependencies: [TransientLogger],
 *   create: ({ logger }) => {
 *     // This logger is unique to ServiceA
 *   },
 * });
 *
 * const ServiceB = defineModule({
 *   name: 'serviceB',
 *   dependencies: [TransientLogger],
 *   create: ({ logger }) => {
 *     // This logger is a DIFFERENT instance, unique to ServiceB
 *   },
 * });
 *
 * // Use: pass modules that depend on transients
 * const svc = compose(ServiceA, ServiceB);
 * // NOT: compose(TransientLogger) - will throw error
 * ```
 */
export function transient<TName extends string, TImpl, TDeps>(
  module: Module<TName, TImpl, TDeps>
): TransientModule<TName, TImpl, TDeps> {
  return {
    ...module,
    __scope: 'transient',
  } as TransientModule<TName, TImpl, TDeps>;
}

/**
 * Check if a module is transient scoped
 */
export function isTransient(module: AnyModule): module is TransientModule {
  return module.__scope === 'transient';
}

/**
 * Marker for transient modules - creates fresh instance per dependent
 */
export interface TransientModule<
  TName extends string = string,
  TImpl = unknown,
  TDeps = unknown,
> extends Module<TName, TImpl, TDeps> {
  __scope: 'transient';
}

/**
 * Marker for lazy (async) modules
 */
export interface LazyModule<
  TName extends string = string,
  TImpl = unknown,
  TDeps = unknown,
> extends Module<TName, TImpl, TDeps> {
  __lazy: true;
}

/**
 * Check if a module is lazy (async)
 */
export function isLazy(module: AnyModule): module is LazyModule {
  return '__lazy' in module && (module as LazyModule).__lazy === true;
}

/**
 * Mark a module with async create() as lazy.
 *
 * Lazy modules are awaited during composition. When compose() includes lazy
 * modules, it returns a Promise that resolves after all async modules are
 * initialized.
 *
 * @example
 * ```ts
 * const DbModule = defineModule({
 *   name: 'db',
 *   create: async () => {
 *     const pool = await createPool();
 *     await pool.connect();
 *     return pool;
 *   },
 * });
 *
 * // Must wrap async modules with lazy()
 * const svc = await compose(lazy(DbModule), CacheModule);
 *
 * // After await, db is fully resolved - sync access
 * svc.db.query('SELECT 1');
 * ```
 */
export function lazy<TName extends string, TImpl, TDeps>(
  module: Module<TName, Promise<TImpl>, TDeps>
): LazyModule<TName, TImpl, TDeps> {
  return {
    ...module,
    __lazy: true,
  } as LazyModule<TName, TImpl, TDeps>;
}
