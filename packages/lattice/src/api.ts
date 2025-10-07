/**
 * Factory-based API creation for Lattice
 *
 * Provides a convenience wrapper for creating contexts from factories that need
 * runtime dependencies (like shared state/context).
 *
 * This is useful when you want to:
 * 1. Create multiple extension instances that share context
 * 2. Inject dependencies into extension factories
 * 3. Maintain type safety across factory -> extension -> API
 */

import { createContext, type LatticeExtension } from './extension';

// Generic factory type - takes some context and returns an extension
export type ExtensionFactory<
  TName extends string,
  TMethod,
  TCtx = unknown
> = (ctx: TCtx) => LatticeExtension<TName, TMethod>;

// Internal type for type-level operations
type Factory = (ctx: never) => LatticeExtension<string, unknown>;

// Helper to extract context requirements from factories
type ExtractContextRequirements<T extends Record<string, Factory>> =
  T[keyof T] extends (ctx: infer C) => unknown ? (C extends never ? unknown : C) : never;

/**
 * Create an API from a set of factories and shared context
 *
 * @example
 * ```ts
 * const factories = {
 *   counter: (ctx) => ({
 *     name: 'counter',
 *     method: () => ctx.count++
 *   }),
 *   reset: (ctx) => ({
 *     name: 'reset',
 *     method: () => ctx.count = 0
 *   })
 * };
 *
 * const api = createApi(factories, { count: 0 });
 * api.counter(); // 1
 * api.reset();   // 0
 * ```
 */
export function createApi<
  T extends Record<string, Factory>,
  TCtx extends ExtractContextRequirements<T>,
>(factories: T, ctx: TCtx) {
  return createContext(...Object.values(factories).map((factory) =>
    factory(ctx as never)
  ) as ReturnType<T[keyof T]>[]);
}
