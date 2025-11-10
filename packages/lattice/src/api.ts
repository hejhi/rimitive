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

import { createContext, CreateContextOptions, type LatticeExtension } from './extension';
import { type Instantiatable } from './component';

// Internal type for type-level operations
type InstantiableExtension = Instantiatable<LatticeExtension<string, unknown>, unknown>;

// Helper to extract context requirements from instantiables
// Uses UnionToIntersection to combine all context requirements
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type ExtractContextRequirements<T extends Record<string, InstantiableExtension>> =
  UnionToIntersection<T[keyof T] extends Instantiatable<unknown, infer C> ? C : never>;

/**
 * Create an API from a set of Instantiable components and shared context
 */
export function createApi<
  T extends Record<string, InstantiableExtension>,
  TCtx extends ExtractContextRequirements<T>,
  >(extensions: T, ctx: TCtx, options?: CreateContextOptions) {
  const mappedComponents = Object.values(extensions).map((ext) =>
    ext.create(ctx)
  ) as ReturnType<T[keyof T]['create']>[];

  if (options) return createContext(options, ...mappedComponents);
  return createContext(...mappedComponents);
}
