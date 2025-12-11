/**
 * Module composition for Lattice
 *
 * @module
 */

import type {
  InstrumentationContext,
  ServiceContext,
  Use,
  ComposedContext,
} from './types';
import { type AnyModule, isModule } from './module';

type ContextState = {
  disposed: boolean;
  disposers: Set<() => void>;
};

/**
 * Options for composing modules
 *
 * @example
 * ```ts
 * import { compose, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
 * import { Signal, Computed } from '@lattice/signals';
 *
 * const instrumentation = createInstrumentation({
 *   enabled: true,
 *   providers: [devtoolsProvider()],
 * });
 *
 * const use = compose(Signal, Computed, { instrumentation });
 * ```
 */
export type ComposeOptions = {
  /** Optional instrumentation context for debugging/profiling */
  instrumentation?: InstrumentationContext;
};

/**
 * Collect all modules including transitive dependencies
 * Returns modules in dependency order (dependencies before dependents)
 */
function collectModules(modules: AnyModule[]): AnyModule[] {
  const visited = new Set<string>();
  const result: AnyModule[] = [];

  function visit(mod: AnyModule) {
    if (visited.has(mod.name)) return;
    visited.add(mod.name);

    // Visit dependencies first (ensures they're created before dependents)
    for (const dep of mod.dependencies) {
      visit(dep);
    }

    result.push(mod);
  }

  for (const mod of modules) {
    visit(mod);
  }

  return result;
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
 * import { compose } from '@lattice/lattice';
 * import { Signal, Computed, Effect } from '@lattice/signals';
 *
 * const use = compose(Signal, Computed, Effect);
 * const { signal, computed, effect } = use();
 *
 * const count = signal(0);
 * const doubled = computed(() => count() * 2);
 * effect(() => console.log(doubled()));
 * ```
 *
 * @example With instrumentation
 * ```ts
 * import { compose, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
 * import { Signal, Computed } from '@lattice/signals';
 *
 * const use = compose(Signal, Computed, {
 *   instrumentation: createInstrumentation({
 *     providers: [devtoolsProvider()],
 *   }),
 * });
 * ```
 *
 * @example Component pattern
 * ```ts
 * const Counter = use(({ signal, computed }) => () => {
 *   const count = signal(0);
 *   return {
 *     value: computed(() => count()),
 *     increment: () => count(c => c + 1),
 *   };
 * });
 * ```
 */
// Overload: modules only
export function compose<TModules extends AnyModule[]>(
  ...modules: TModules
): Use<ComposedContext<TModules>>;

// Overload: modules + options (options must be last)
export function compose<TModules extends AnyModule[]>(
  ...args: [...TModules, ComposeOptions]
): Use<ComposedContext<TModules>>;

// Implementation
export function compose(
  ...args: (AnyModule | ComposeOptions)[]
): Use<Record<string, unknown> & { dispose(): void }> {
  // Separate modules from options
  const lastArg = args[args.length - 1];
  const hasOptions = lastArg && !isModule(lastArg);

  const modules = (hasOptions ? args.slice(0, -1) : args) as AnyModule[];
  const options = hasOptions ? (lastArg as ComposeOptions) : undefined;

  // Validate no duplicate names in input modules (different instances with same name)
  const seenNames = new Map<string, AnyModule>();
  for (const mod of modules) {
    const existing = seenNames.get(mod.name);
    if (existing && existing !== mod) {
      throw new Error(`Duplicate module name: ${mod.name}`);
    }
    seenNames.set(mod.name, mod);
  }

  // Collect all modules including transitive dependencies
  const allModules = collectModules(modules);

  // State management
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

  // Build the context - resolved deps namespace
  const resolvedDeps: Record<string, unknown> = {};

  // Context object that will be returned
  const context: Record<string, unknown> & { dispose(): void } = {
    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;

      // Call destroy hooks in reverse order
      for (let i = allModules.length - 1; i >= 0; i--) {
        const mod = allModules[i];
        if (mod) mod.destroy?.(serviceCtx);
      }

      // Run registered disposers
      for (const disposer of state.disposers) {
        disposer();
      }
      state.disposers.clear();
    },
  };

  // Create each module in dependency order
  for (const mod of allModules) {
    // Call init hook
    mod.init?.(serviceCtx);

    // Create the implementation with resolved deps
    let impl = mod.create(resolvedDeps);

    // Apply instrumentation if enabled
    if (options?.instrumentation && mod.instrument) {
      impl = mod.instrument(impl, options.instrumentation, serviceCtx);
    }

    // Add to resolved deps (for other modules to use)
    resolvedDeps[mod.name] = impl;

    // Add to context (for user access)
    context[mod.name] = impl;
  }

  // Create a callable that also has all context properties
  // The callable passes ITSELF (with call signature) to the callback,
  // not just the plain context object. This allows portables to call
  // other portables using the same Use object.
  type ContextType = Record<string, unknown> & { dispose(): void };

  const use = (<TResult>(fn: (ctx: ContextType) => TResult): TResult => {
    // Pass `use` itself (the callable with properties) to the callback
    return fn(use as ContextType);
  }) as Use<ContextType>;

  // Copy all context properties onto the function
  Object.assign(use, context);

  return use;
}

/**
 * Merge additional properties into a Use context.
 *
 * Creates a new `Use` that has all properties from the base plus the additions.
 * The base service instances are preserved (not cloned), so you stay on the
 * same reactive graph.
 *
 * @example
 * ```ts
 * import { compose, merge } from '@lattice/lattice';
 * import { Signal } from '@lattice/signals';
 *
 * const use = compose(Signal);
 *
 * // Add new properties
 * const extended = merge(use, { theme: createTheme() });
 * extended.theme; // available
 * extended.signal; // same instance as use.signal
 *
 * // Override existing properties for a subtree
 * const childUse = merge(use, { signal: customSignal });
 * ```
 *
 * @example Inside a component
 * ```ts
 * const MyComponent = use((svc) => {
 *   // Add router for this subtree
 *   const childUse = merge(use, createRouter(svc));
 *
 *   return () => childUse(ChildComponent);
 * });
 * ```
 */
export function merge<TSvc, TAdditions extends object>(
  base: Use<TSvc>,
  additions: TAdditions
): Use<Omit<TSvc, keyof TAdditions> & TAdditions> {
  const merged = { ...base, ...additions };

  type MergedType = typeof merged;

  // Create a new callable that passes ITSELF to the callback
  // This allows portables to call other portables using the same Use object
  const mergedUse = (<TResult>(fn: (svc: MergedType) => TResult) =>
    fn(mergedUse)) as Use<MergedType>;

  // Merge base properties with additions (additions override base)
  // Copy merged properties onto the function
  Object.assign(mergedUse, merged);

  return mergedUse;
}
