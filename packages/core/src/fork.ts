/**
 * Fork utility for creating scoped compositions
 *
 * @module
 */

import { type AnyModule, isTransient, isLazy } from './module';
import type { InstrumentationContext, ServiceContext, Use } from './types';
import { tryDispose } from './utils';

/**
 * Options for forking a context
 */
export type ForkOptions = {
  /** Optional instrumentation context for debugging/profiling fresh modules */
  instrumentation?: InstrumentationContext;
};

/**
 * Create a new composition that shares instances from an existing one,
 * but with fresh instances of specified modules.
 *
 * Fresh modules are:
 * - Re-instantiated (not shared with the base)
 * - Singleton within the fork (shared by dependents in the forked context)
 * - Disposed when the fork is disposed (base instances are not affected)
 *
 * Fresh modules can depend on base instances - they receive the base
 * singletons as their dependencies.
 *
 * @example Basic usage
 * ```ts
 * const root = compose(ConfigModule, DbPoolModule, DbConnectionModule);
 *
 * // Create a fork with fresh DbConnection
 * const scoped = fork(root, [DbConnectionModule]);
 *
 * scoped.config        // Same instance as root (shared)
 * scoped.dbPool        // Same instance as root (shared)
 * scoped.dbConnection  // Fresh instance (not root's)
 *
 * // Cleanup fresh instances
 * scoped.dispose();
 * // root is unaffected
 * ```
 *
 * @example Per-request context in a server
 * ```ts
 * const root = compose(ConfigModule, DbPoolModule);
 *
 * app.use((req, res, next) => {
 *   req.svc = fork(root, [DbConnectionModule, RequestContextModule]);
 *   res.on('finish', () => req.svc.dispose());
 *   next();
 * });
 * ```
 *
 * @example Test isolation
 * ```ts
 * const root = compose(AllModules);
 *
 * beforeEach(() => {
 *   testSvc = fork(root, [StateModule]); // Fresh state per test
 * });
 *
 * afterEach(() => {
 *   testSvc.dispose();
 * });
 * ```
 *
 * @example Async fresh modules
 * ```ts
 * const root = await compose(ConfigModule, lazy(DbPoolModule));
 *
 * // Fork with lazy module returns a Promise
 * const scoped = await fork(root, [lazy(DbConnectionModule)]);
 * ```
 *
 * @example With instrumentation
 * ```ts
 * const root = compose(ConfigModule, DbPoolModule, { instrumentation });
 *
 * // Fork can have its own instrumentation for fresh modules
 * const scoped = fork(root, [DbConnectionModule], { instrumentation: scopedInstr });
 * ```
 */
export function fork<TBase>(
  base: Use<TBase>,
  freshModules: AnyModule[],
  options?: ForkOptions
): Use<TBase> | Promise<Use<TBase>> {
  // Collect fresh modules in dependency order
  const visited = new Set<string>();
  const orderedFresh: AnyModule[] = [];

  function collectModule(mod: AnyModule) {
    if (visited.has(mod.name)) return;
    visited.add(mod.name);

    // First collect dependencies that are also being refreshed
    for (const dep of mod.dependencies) {
      if (freshModules.some((m) => m.name === dep.name)) {
        collectModule(dep);
      }
    }

    orderedFresh.push(mod);
  }

  for (const mod of freshModules) {
    collectModule(mod);
  }

  const hasLazyModules = orderedFresh.some(isLazy);

  const forkState = {
    disposed: false,
    disposers: new Set<() => void>(),
  };

  const forkServiceCtx: ServiceContext = {
    destroy(cleanup: () => void): void {
      forkState.disposers.add(cleanup);
    },
    get isDestroyed(): boolean {
      return forkState.disposed;
    },
  };

  // Start with base instances, copy properties (excluding dispose)
  const baseContext: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    if (key !== 'dispose') {
      baseContext[key] = (base as Record<string, unknown>)[key];
    }
  }

  const resolvedDeps: Record<string, unknown> = { ...baseContext };
  const freshTransientModules = new Map<string, AnyModule>();
  const transientInstances: unknown[] = [];
  const initializedTransients = new Set<AnyModule>();

  // Instrumentation helper - wraps impl if module has instrument hook
  const instrument = (mod: AnyModule, impl: unknown): unknown => {
    if (!options?.instrumentation || !mod.instrument) return impl;
    return mod.instrument(impl, options.instrumentation, forkServiceCtx);
  };

  const ensureTransientInitialized = (mod: AnyModule): void => {
    if (initializedTransients.has(mod)) return;
    mod.init?.(forkServiceCtx);
    initializedTransients.add(mod);
  };

  const createFreshTransient = (
    transientMod: AnyModule,
    baseDeps: Record<string, unknown>
  ): unknown => {
    // Ensure init() is called for this transient in the fork context
    ensureTransientInitialized(transientMod);

    // Build deps for this transient, recursively creating fresh transients
    const depsForTransient: Record<string, unknown> = { ...baseDeps };
    for (const dep of transientMod.dependencies) {
      // Check both freshTransientModules and the dep itself for transient scope
      const freshTransient = freshTransientModules.get(dep.name);
      if (freshTransient) {
        depsForTransient[dep.name] = createFreshTransient(freshTransient, baseDeps);
      } else if (isTransient(dep)) {
        depsForTransient[dep.name] = createFreshTransient(dep, baseDeps);
      }
    }

    const freshImpl = instrument(transientMod, transientMod.create(depsForTransient));
    transientInstances.push(freshImpl);
    return freshImpl;
  };

  const buildDepsForModule = (mod: AnyModule): Record<string, unknown> => {
    const depsForModule: Record<string, unknown> = { ...resolvedDeps };

    for (const dep of mod.dependencies) {
      // Check if this dependency is transient - either:
      // 1. It's a fresh transient module in this fork
      // 2. It's a transient module from the original composition (check the dep itself)
      const freshTransient = freshTransientModules.get(dep.name);
      if (freshTransient) {
        depsForModule[dep.name] = createFreshTransient(freshTransient, resolvedDeps);
      } else if (isTransient(dep)) {
        depsForModule[dep.name] = createFreshTransient(dep, resolvedDeps);
      }
    }

    return depsForModule;
  };

  const createUse = (
    forkContext: Record<string, unknown> & { dispose(): void }
  ): Use<TBase> => {
    type ForkType = typeof forkContext;

    const use = (<TResult>(fn: (ctx: ForkType) => TResult): TResult => {
      return fn(use as ForkType);
    }) as Use<ForkType>;

    Object.assign(use, forkContext);

    return use as Use<TBase>;
  };

  const buildForkContext = (): Record<string, unknown> & { dispose(): void } => {
    return {
      ...resolvedDeps,
      dispose(): void {
        if (forkState.disposed) return;
        forkState.disposed = true;

        // Dispose transient instances (in reverse creation order)
        for (let i = transientInstances.length - 1; i >= 0; i--)
          tryDispose(transientInstances[i]);
        transientInstances.length = 0;

        // Call destroy hooks in reverse order (only for fresh modules)
        for (let i = orderedFresh.length - 1; i >= 0; i--) {
          const mod = orderedFresh[i];
          if (mod) mod.destroy?.(forkServiceCtx);
        }

        for (const disposer of forkState.disposers) {
          disposer();
        }
        forkState.disposers.clear();
      },
    };
  };

  if (hasLazyModules) {
    return (async () => {
      for (const mod of orderedFresh) {
        mod.init?.(forkServiceCtx);

        if (isTransient(mod)) {
          initializedTransients.add(mod); // Track so we don't double-init
          freshTransientModules.set(mod.name, mod);
          continue; // Transients are created per-dependent, not exposed on context
        }

        const depsForModule = buildDepsForModule(mod);
        let impl = mod.create(depsForModule);

        if (isLazy(mod) && impl instanceof Promise) {
          impl = await impl;
        }

        resolvedDeps[mod.name] = instrument(mod, impl);
      }

      return createUse(buildForkContext());
    })();
  }

  for (const mod of orderedFresh) {
    mod.init?.(forkServiceCtx);

    if (isTransient(mod)) {
      initializedTransients.add(mod); // Track so we don't double-init
      freshTransientModules.set(mod.name, mod);
      continue; // Transients are created per-dependent, not exposed on context
    }

    const depsForModule = buildDepsForModule(mod);
    const impl = mod.create(depsForModule);
    resolvedDeps[mod.name] = instrument(mod, impl);
  }

  return createUse(buildForkContext());
}
