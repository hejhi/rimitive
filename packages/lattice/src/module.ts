/**
 * Module system for Lattice
 *
 * Modules are the fundamental unit of composition in Lattice. They declare
 * dependencies on other modules and provide an implementation.
 *
 * Think of modules like npm packages:
 * - package.json "dependencies" → Module declares what it requires
 * - npm install / node_modules → compose() resolves the graph
 * - import X from 'x' → deps are available by name
 *
 * @example
 * ```ts
 * import { defineModule, compose } from '@lattice/lattice';
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
 * A module definition - the unit of composition in Lattice.
 *
 * Modules declare their dependencies and provide a create function
 * that receives resolved dependencies and returns the implementation.
 *
 * @example
 * ```ts
 * const MyModule: Module<'myModule', MyImpl> = {
 *   status: STATUS_MODULE,
 *   name: 'myModule',
 *   dependencies: [OtherModule],
 *   create: ({ otherModule }) => createMyImpl(otherModule),
 * };
 * ```
 */
/**
 * Base module interface for dependency arrays.
 * Uses interface + method syntax for bivariant function parameters.
 * This allows Module<specific> to be assignable to AnyModule.
 */
export interface AnyModule {
  status: typeof STATUS_MODULE;
  name: string;
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
 * A module definition - the unit of composition in Lattice.
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
 * Input type for defineModule - same as Module but without status
 * and with optional dependencies.
 */
export interface ModuleDefinition<
  TName extends string,
  TImpl,
  TDeps,
> {
  /** Unique name - becomes the property name on the composed context */
  name: TName;

  /** Modules this module depends on (resolved by compose) */
  dependencies?: AnyModule[];

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
 * Check if a value is a Module
 */
export function isModule(value: unknown): value is Module {
  return (
    value !== null &&
    typeof value === 'object' &&
    'status' in value &&
    (value as Module).status === STATUS_MODULE
  );
}

/**
 * Define a module - the fundamental building block of Lattice composition.
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
export function defineModule<TName extends string, TImpl, TDeps>(
  definition: ModuleDefinition<TName, TImpl, TDeps>
): Module<TName, TImpl, TDeps> {
  return {
    status: STATUS_MODULE,
    name: definition.name,
    dependencies: definition.dependencies ?? [],
    create: definition.create,
    ...(definition.instrument && { instrument: definition.instrument }),
    ...(definition.init && { init: definition.init }),
    ...(definition.destroy && { destroy: definition.destroy }),
  };
}

/**
 * Helper type to extract the implementation type from a Module
 */
export type ModuleImpl<T> = T extends Module<string, infer TImpl, unknown>
  ? TImpl
  : never;

/**
 * Helper type to extract the name from a Module
 */
export type ModuleName<T> = T extends Module<infer TName, unknown, unknown>
  ? TName
  : never;

/**
 * Helper type to extract the deps type from a Module
 */
export type ModuleDeps<T> = T extends Module<string, unknown, infer TDeps>
  ? TDeps
  : never;
