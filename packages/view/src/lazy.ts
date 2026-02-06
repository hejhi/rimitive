/**
 * Lazy loading for dynamic imports
 *
 * lazy() wraps a dynamic import into a callable stand-in. On the server
 * (or when the import has resolved), calls pass through directly. On the
 * client before the chunk loads, it creates a reactive async boundary
 * using signal + match so the content appears when the chunk arrives.
 *
 * The importer should resolve to a function that produces a RefSpec when
 * called — lazy() intercepts exactly one call level:
 *
 *   lazy(() => import('./Chart').then(m => m.Chart(svc)))
 *   //=> (...args) => RefSpec   — call it to get the boundary
 */

import type { RefSpec } from './types';
import { STATUS_REF_SPEC } from './types';
import { ASYNC_FRAGMENT, type AsyncMeta, type AsyncFragment } from './load';
import { defineModule, type Module } from '@rimitive/core';
import { SignalModule, type SignalFactory } from '@rimitive/signals/signal';
import { MatchModule, type MatchFactory } from './match';

// =============================================================================
// Types
// =============================================================================

/**
 * Callable lazy factory — call it to wrap a dynamic import, access
 * `.preloadAll()` to wait for all pending imports.
 *
 * @example
 * ```ts
 * const { lazy } = compose(LazyModule);
 *
 * const LazyChart = lazy(() => import('./Chart').then(m => m.Chart));
 * await lazy.preloadAll();
 * ```
 */
export type LazyFunction = {
  <T>(importer: () => Promise<T>): T;
  preloadAll(): Promise<void>;
};

/** Internal match signature used by lazy boundary (element-type-agnostic) */
type LazyMatchFn = (
  reactive: () => unknown,
  matcher: (val: unknown) => RefSpec<unknown> | null
) => RefSpec<unknown>;

export type LazyOpts = {
  signal: SignalFactory;
  match: LazyMatchFn;
};

/**
 * Create a lazy function with a closure-scoped registry.
 */
export function createLazyFunction(opts: LazyOpts): LazyFunction {
  const { signal, match } = opts;
  const registry = new Set<Promise<unknown>>();

  function lazy<T>(importer: () => Promise<T>): T {
    let cached: T | undefined;
    const promise = importer().then((val) => {
      cached = val;
      return val;
    });
    registry.add(promise);
    // Clean up the registry when settled, and suppress unhandled-rejection
    // warnings. The actual rejection is still observable via meta.resolve().
    promise.then(
      () => registry.delete(promise),
      () => registry.delete(promise)
    );

    const wrapper = (...args: unknown[]): unknown => {
      if (cached !== undefined) {
        return (cached as (...a: unknown[]) => unknown)(...args);
      }
      return createLazyBoundary(signal, match, promise, () => cached, args);
    };

    return wrapper as T;
  }

  lazy.preloadAll = async function preloadAll(): Promise<void> {
    await Promise.all([...registry]);
  };

  return lazy as LazyFunction;
}

/**
 * Lazy module — provides `lazy()` for code-splitting with async boundaries.
 *
 * @example
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { LazyModule } from '@rimitive/view/lazy';
 *
 * const { lazy } = compose(LazyModule);
 *
 * // Resolve to a RefSpec-producing function in .then():
 * const LazyChart = lazy(() => import('./Chart').then(m => m.Chart(svc)));
 * const view = LazyChart(data);
 *
 * await lazy.preloadAll();
 * ```
 */
export const LazyModule: Module<
  'lazy',
  LazyFunction,
  { signal: SignalFactory; match: MatchFactory<Node> }
> = defineModule({
  name: 'lazy',
  dependencies: [SignalModule, MatchModule.module],
  create: ({
    signal,
    match,
  }: {
    signal: SignalFactory;
    match: MatchFactory<Node>;
  }) => createLazyFunction({ signal, match: match as LazyMatchFn }),
});

function createLazyBoundary(
  signal: SignalFactory,
  match: LazyMatchFn,
  promise: Promise<unknown>,
  getCached: () => unknown,
  args: unknown[]
): RefSpec<unknown> {
  // Mid-flight fast path: import resolved between lazy() and this call
  const resolved = getCached();
  if (resolved !== undefined) {
    return (resolved as (...a: unknown[]) => RefSpec<unknown>)(...args);
  }

  // Slow path: create a reactive boundary using injected signal + match
  const loaded = signal<unknown>(undefined);

  // Update signal when import resolves → match re-renders with real content
  promise.then(
    (val) => loaded(val),
    () => {} // Rejection observable via meta.resolve()
  );

  // match: null while pending, real component when loaded
  const matchSpec = match(
    () => loaded(),
    (val: unknown) => {
      if (val === undefined) return null;
      return (val as (...a: unknown[]) => RefSpec<unknown>)(...args);
    }
  );

  // Async metadata for SSR/hydration introspection
  const meta: AsyncMeta<unknown> = {
    resolve: async () => {
      if (getCached() !== undefined) return getCached();
      const val = await promise;
      loaded(val);
      return val;
    },
    getData: () => getCached(),
    setData: (data: unknown) => {
      loaded(data);
    },
    isResolved: () => getCached() !== undefined,
    // Import already in flight; signal update triggers match re-render
    trigger: () => {},
  };

  // Wrap match's RefSpec to attach ASYNC_FRAGMENT metadata on the created node
  const refSpec = (() => refSpec) as unknown as RefSpec<unknown>;
  refSpec.status = STATUS_REF_SPEC;
  refSpec.create = <TExt>(_svc?: unknown, extensions?: TExt) => {
    const nodeRef = matchSpec.create(_svc, extensions);
    (nodeRef as AsyncFragment<unknown, unknown>)[ASYNC_FRAGMENT] = meta;
    return nodeRef;
  };

  return refSpec;
}
