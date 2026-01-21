/**
 * Override utility for swapping module dependencies
 *
 * @module
 */

import type { AnyModule, Module, ModuleDeps, ModuleName, ModuleImpl } from './module';

/**
 * Marker interface for overridden modules that tracks replacement modules.
 * This allows compose() to include replacement modules in the context type.
 */
export interface OverriddenModule<
  TName extends string,
  TImpl,
  TDeps,
  TReplacements extends AnyModule[],
> extends Module<TName, TImpl, TDeps> {
  __replacements: TReplacements;
}

/**
 * Convert a replacements object to a tuple of its module values.
 */
type ReplacementsToTuple<R> = R extends Record<string, AnyModule>
  ? R[keyof R] extends AnyModule
    ? R[keyof R][]
    : never
  : never;

/**
 * Override dependencies of a module.
 *
 * Creates a new module with the same implementation but different dependencies.
 * Useful for testing (swapping real services for mocks) or environment-specific
 * configurations.
 *
 * Replacements are matched by the dependency's name. If a replacement module has
 * a different name, it will be aliased to the original dependency's name.
 *
 * @example Testing with mocks
 * ```ts
 * const MockDB = defineModule({
 *   name: 'db',
 *   create: () => ({ query: vi.fn() }),
 * });
 *
 * const testSvc = compose(override(UserService, { db: MockDB }));
 * ```
 *
 * @example Environment-specific dependencies
 * ```ts
 * const prodSvc = compose(override(App, { logger: CloudLogger }));
 * const devSvc = compose(override(App, { logger: ConsoleLogger }));
 * ```
 */
export function override<
  T extends AnyModule,
  R extends { [K in keyof ModuleDeps<T>]?: Module<string, ModuleDeps<T>[K], unknown> },
>(
  mod: T,
  replacements: R
): OverriddenModule<
  ModuleName<T>,
  ModuleImpl<T>,
  ModuleDeps<T>,
  ReplacementsToTuple<R> extends AnyModule[] ? ReplacementsToTuple<R> : never[]
> {
  const newDeps = mod.dependencies.map((dep) => {
    const replacement = (replacements as Record<string, AnyModule>)[dep.name];
    if (replacement) {
      // If replacement has a different name, alias it to the expected name
      // Store reference to original module so compose() can cache correctly
      if (replacement.name !== dep.name) {
        return { ...replacement, name: dep.name, __aliasOf: replacement };
      }
      return replacement;
    }
    return dep;
  });

  // Store replacement modules for type-level tracking
  const replacementModules = Object.values(replacements).filter(
    (m): m is AnyModule => m !== undefined
  );

  return {
    ...mod,
    dependencies: newDeps,
    __replacements: replacementModules,
  } as unknown as OverriddenModule<
    ModuleName<T>,
    ModuleImpl<T>,
    ModuleDeps<T>,
    ReplacementsToTuple<R> extends AnyModule[] ? ReplacementsToTuple<R> : never[]
  >;
}

/**
 * Check if a module is an overridden module with replacements.
 */
export function isOverriddenModule(
  mod: AnyModule
): mod is OverriddenModule<string, unknown, unknown, AnyModule[]> {
  return '__replacements' in mod;
}
