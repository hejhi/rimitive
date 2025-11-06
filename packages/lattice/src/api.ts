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

import { createContext, type LatticeExtension } from './extension';
import { type Instantiatable } from './component';

// Internal type for type-level operations
type InstantiableExtension = Instantiatable<LatticeExtension<string, unknown>, unknown>;

// Helper to extract context requirements from instantiables
type ExtractContextRequirements<T extends Record<string, InstantiableExtension>> =
  T[keyof T] extends Instantiatable<unknown, infer C> ? C : never;

/**
 * Create an API from a set of Instantiable components and shared context
 *
 * @example
 * ```ts
 * const Signal = create((ctx: { count: number }) => () => ({
 *   name: 'signal',
 *   method: () => ctx.count++
 * }));
 *
 * const Reset = create((ctx: { count: number }) => () => ({
 *   name: 'reset',
 *   method: () => ctx.count = 0
 * }));
 *
 * const components = {
 *   signal: Signal(),
 *   reset: Reset()
 * };
 *
 * const api = createApi(components, { count: 0 });
 * api.signal(); // 1
 * api.reset();  // 0
 * ```
 */
export function createApi<
  T extends Record<string, InstantiableExtension>,
  TCtx extends ExtractContextRequirements<T>,
>(components: T, ctx: TCtx) {
  return createContext(...Object.values(components).map((component) =>
    component.create(ctx as never)
  ) as ReturnType<T[keyof T]['create']>[]);
}
