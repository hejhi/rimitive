/**
 * Module composition for Rimitive
 *
 * @module
 */

import type {
  InstrumentationContext,
  ServiceContext,
  Use,
  ValidatedModules,
  ComposeReturn,
} from './types';
import { type AnyModule, isModule, isTransient, isLazy } from './module';
import { tryDispose } from './utils';

type ContextState = {
  disposed: boolean;
  disposers: Set<() => void>;
};

/**
 * Options for composing modules
 */
export type ComposeOptions = {
  /** Optional instrumentation context for debugging/profiling */
  instrumentation?: InstrumentationContext;
};

/** Check if any module in the dependency graph is lazy (async) */
function hasLazyInGraph(modules: AnyModule[]): boolean {
  const visited = new Set<AnyModule>();
  const check = (mod: AnyModule): boolean => {
    if (visited.has(mod)) return false;
    visited.add(mod);
    return isLazy(mod) || mod.dependencies.some(check);
  };
  return modules.some(check);
}

/** Throw if module returns Promise but isn't marked lazy */
function assertNotAsync(mod: AnyModule, impl: unknown): void {
  if (impl instanceof Promise && !isLazy(mod)) {
    throw new Error(
      `Async create() in module "${mod.name}" requires lazy() wrapper`
    );
  }
}

/** Validate modules passed to compose() */
function validateInputModules(modules: AnyModule[]): void {
  const seenNames = new Map<string, AnyModule>();
  for (const mod of modules) {
    if (isTransient(mod)) {
      throw new Error(
        `Transient module "${mod.name}" cannot be passed directly to compose().`
      );
    }
    const existing = seenNames.get(mod.name);
    if (existing && existing !== mod) {
      throw new Error(`Duplicate module name: ${mod.name}`);
    }
    seenNames.set(mod.name, mod);
  }
}

/**
 * Compose modules into a unified context.
 *
 * Resolves the dependency graph automatically - you only need to pass the
 * modules you want, and their dependencies are included transitively.
 *
 * Returns a `use()` function that provides access to the composed context:
 * - `use()` - Returns the context directly
 * - `use(callback)` - Passes the context to callback and returns its result
 *
 * @example Basic usage
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule);
 * const { signal, computed, effect } = svc;
 *
 * const count = signal(0);
 * const doubled = computed(() => count() * 2);
 * effect(() => console.log(doubled()));
 * ```
 *
 * @example With instrumentation
 * ```ts
 * import { compose, createInstrumentation, devtoolsProvider } from '@rimitive/core';
 * import { SignalModule, ComputedModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule, {
 *   instrumentation: createInstrumentation({
 *     providers: [devtoolsProvider()],
 *   }),
 * });
 * ```
 *
 * @example Behavior pattern
 * ```ts
 * const counter = (svc) => () => {
 *   const count = svc.signal(0);
 *   return {
 *     value: svc.computed(() => count()),
 *     increment: () => count(c => c + 1),
 *   };
 * };
 *
 * const useCounter = svc(counter);
 * const myCounter = useCounter();
 * ```
 */
// Overload: modules only
export function compose<TModules extends AnyModule[]>(
  ...modules: ValidatedModules<TModules>
): ComposeReturn<TModules>;

// Overload: modules + options (options must be last)
export function compose<TModules extends AnyModule[]>(
  ...args: [...ValidatedModules<TModules>, ComposeOptions]
): ComposeReturn<TModules>;

// Implementation (signature must be broader than overloads)
export function compose(
  ...args: unknown[]
):
  | Use<Record<string, unknown> & { dispose(): void }>
  | Promise<Use<Record<string, unknown> & { dispose(): void }>> {
  // Separate modules from options (cast to expected types - validated by overloads)
  const typedArgs = args as (AnyModule | ComposeOptions)[];
  const lastArg = typedArgs[typedArgs.length - 1];
  const hasOptions = lastArg && !isModule(lastArg);

  const modules = (
    hasOptions ? typedArgs.slice(0, -1) : typedArgs
  ) as AnyModule[];
  const options = hasOptions ? lastArg : undefined;

  validateInputModules(modules);

  const hasLazyModules = hasLazyInGraph(modules);

  // Shared state
  const state: ContextState = {
    disposed: false,
    disposers: new Set(),
  };

  const serviceCtx: ServiceContext = {
    destroy(cleanup: () => void): void {
      state.disposers.add(cleanup);
    },
    get isDestroyed(): boolean {
      return state.disposed;
    },
  };

  // Keyed by MODULE REFERENCE, not name - enables localized overrides
  const instanceCache = new Map<AnyModule, unknown>();
  const transientModules = new Set<AnyModule>();
  const transientInstances: unknown[] = [];
  const resolvedModules: AnyModule[] = [];

  // Get cache key for a module - use original if this is an aliased module
  const getCacheKey = (mod: AnyModule): AnyModule => {
    const aliasOf = (mod as { __aliasOf?: AnyModule }).__aliasOf;
    return aliasOf ?? mod;
  };

  const context: Record<string, unknown> & { dispose(): void } = {
    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;

      // Dispose in reverse order: transients, then singletons, then destroy hooks, then registered disposers
      for (let i = transientInstances.length - 1; i >= 0; i--)
        tryDispose(transientInstances[i]);
      transientInstances.length = 0;
      for (let i = resolvedModules.length - 1; i >= 0; i--) {
        const mod = resolvedModules[i]!;
        tryDispose(instanceCache.get(getCacheKey(mod)));
        mod.destroy?.(serviceCtx);
      }
      instanceCache.clear();
      state.disposers.forEach((d) => d());
      state.disposers.clear();
    },
  };

  // === Shared helpers ===

  const instrument = (mod: AnyModule, impl: unknown): unknown => {
    if (!options?.instrumentation || !mod.instrument) return impl;
    return mod.instrument(impl, options.instrumentation, serviceCtx);
  };

  const initModule = (mod: AnyModule): void => {
    mod.init?.(serviceCtx);
    resolvedModules.push(mod);
  };

  const initTransient = (mod: AnyModule): void => {
    if (transientModules.has(mod)) return;
    initModule(mod);
    transientModules.add(mod);
  };

  const cacheAndExpose = (mod: AnyModule, impl: unknown): unknown => {
    const final = instrument(mod, impl);
    instanceCache.set(getCacheKey(mod), final);
    if (!(mod.name in context)) context[mod.name] = final;
    return final;
  };

  // === Sync resolver ===

  const resolveSync = (mod: AnyModule): unknown => {
    if (isTransient(mod)) {
      initTransient(mod);
      return undefined;
    }
    const cacheKey = getCacheKey(mod);
    if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey);

    initModule(mod);
    const deps = buildDepsSync(mod);
    const impl = mod.create(deps);
    assertNotAsync(mod, impl);
    return cacheAndExpose(mod, impl);
  };

  const createTransientSync = (mod: AnyModule): unknown => {
    const impl = instrument(mod, mod.create(buildDepsSync(mod)));
    transientInstances.push(impl);
    return impl;
  };

  const buildDepsSync = (mod: AnyModule): Record<string, unknown> => {
    const deps: Record<string, unknown> = {};
    for (const dep of mod.dependencies) {
      const isT = isTransient(dep);
      if (isT) initTransient(dep);
      deps[dep.name] = isT ? createTransientSync(dep) : resolveSync(dep);
    }
    return deps;
  };

  // === Async resolver ===
  const createTransientAsync = async (mod: AnyModule): Promise<unknown> => {
    let impl = mod.create(await buildDepsAsync(mod));
    if (isLazy(mod) && impl instanceof Promise) impl = await impl;
    impl = instrument(mod, impl);
    transientInstances.push(impl);
    return impl;
  };

  const resolveAsync = async (mod: AnyModule): Promise<unknown> => {
    if (isTransient(mod)) {
      initTransient(mod);
      return undefined;
    }
    const cacheKey = getCacheKey(mod);
    if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey);

    initModule(mod);
    const deps = await buildDepsAsync(mod);
    let impl = mod.create(deps);
    assertNotAsync(mod, impl);
    if (isLazy(mod) && impl instanceof Promise) impl = await impl;
    return cacheAndExpose(mod, impl);
  };

  const buildDepsAsync = async (
    mod: AnyModule
  ): Promise<Record<string, unknown>> => {
    const deps: Record<string, unknown> = {};
    for (const dep of mod.dependencies) {
      const isT = isTransient(dep);
      if (isT) initTransient(dep);
      deps[dep.name] = isT
        ? await createTransientAsync(dep)
        : await resolveAsync(dep);
    }
    return deps;
  };

  const createUse = (): Use<Record<string, unknown> & { dispose(): void }> => {
    const use = ((fn: (ctx: typeof context) => unknown) =>
      fn(use as typeof context)) as Use<typeof context>;
    return Object.assign(use, context);
  };

  if (hasLazyModules) {
    return (async () => {
      for (const mod of modules) await resolveAsync(mod);
      return createUse();
    })();
  }
  for (const mod of modules) resolveSync(mod);
  return createUse();
}
