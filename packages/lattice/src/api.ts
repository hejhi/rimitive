/**
 * Component-based API creation for Lattice
 *
 * Provides a convenience wrapper for creating contexts from Instantiable components
 * that need runtime context injection.
 *
 * This is useful when you want to:
 * 1. Create multiple extension instances that share context
 * 2. Inject dependencies into components at instantiation time
 * 3. Maintain type safety across component -> extension -> API
 */

import {
  compose,
  CreateContextOptions,
  type ServiceDefinition,
} from './extension';
import { type Service } from './types';

// Internal type for type-level operations
export type DefinedService<TDeps = unknown> = Service<
  ServiceDefinition<string, TDeps>,
  TDeps
>;

// Helper to extract context requirements from instantiables
// Uses UnionToIntersection to combine all context requirements
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

type ExtractDeps<T extends Record<string, DefinedService>> =
  UnionToIntersection<T[keyof T] extends Service<unknown, infer C> ? C : never>;

/**
 * Create an API from a set of Instantiable components and shared context
 */
export function composeFrom<
  T extends Record<string, DefinedService>,
  TDeps extends ExtractDeps<T>,
>(extensions: T, deps: TDeps, options?: CreateContextOptions) {
  const mappedComponents = Object.values(extensions).map((ext) =>
    ext(deps)
  ) as ReturnType<T[keyof T]>[];

  if (options) return compose(options, ...mappedComponents);
  return compose(...mappedComponents);
}
