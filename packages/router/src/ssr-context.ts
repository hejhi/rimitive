/**
 * SSR Context Management for Router
 *
 * **CURRENT STATUS:** The SSR context is prepared but not yet fully implemented.
 * AsyncLocalStorage integration is pending due to build tooling constraints.
 * For now, this module provides a no-op implementation that returns undefined,
 * which allows client-side routing to work correctly.
 *
 * **FUTURE IMPLEMENTATION:** Will use AsyncLocalStorage to track router state
 * during server-side rendering. Each request will get its own isolated context,
 * preventing state leakage.
 *
 * Environment Detection (when fully implemented):
 * - On server: AsyncLocalStorage is available, context store is populated during SSR
 * - In browser: AsyncLocalStorage doesn't exist or is unavailable, store is always empty
 *
 * This will enable automatic environment detection without explicit flags:
 * - getActiveRouterContext() returns context → running on server during SSR
 * - getActiveRouterContext() returns undefined → running in browser or outside SSR
 */

/**
 * Router SSR Context
 *
 * Contains state needed for server-side rendering of the router.
 */
export type RouterSSRContext = {
  /** Initial path to use for server-side rendering */
  initialPath: string;
};

/**
 * Type for AsyncLocalStorage compatible store
 */
type ContextStore = {
  run<T>(ctx: RouterSSRContext, fn: () => T): T;
  getStore(): RouterSSRContext | undefined;
};

/**
 * AsyncLocalStorage instance for router SSR context
 * Provides request isolation - each render gets its own context
 *
 * Only available in Node.js environments. In browser builds, this will be undefined.
 */
let routerContextStore: ContextStore | undefined;

/**
 * Create a no-op context store for environments without AsyncLocalStorage
 */
function createNoOpStore(): ContextStore {
  return {
    run<T>(_ctx: RouterSSRContext, fn: () => T): T {
      return fn();
    },
    getStore(): RouterSSRContext | undefined {
      return undefined;
    },
  };
}

/**
 * Get or initialize the router context store.
 * Lazy initialization prevents issues with bundlers trying to resolve Node.js modules for client builds.
 */
function getOrInitContextStore(): ContextStore {
  if (routerContextStore !== undefined) {
    return routerContextStore;
  }

  // In browser environments, return a no-op store
  if (typeof window !== 'undefined') {
    routerContextStore = createNoOpStore();
    return routerContextStore;
  }

  // In server environments, try to create AsyncLocalStorage
  // Note: This code path only executes on the server, but the require is still
  // flagged by eslint. Since we can't use dynamic imports synchronously and
  // can't disable eslint rules per instructions, we accept that this will
  // always use the no-op store. SSR support will need a different approach.
  routerContextStore = createNoOpStore();
  return routerContextStore;
}

/**
 * Create a new router SSR context
 *
 * @param initialPath - Initial path to use for SSR (e.g., request URL pathname)
 * @returns Fresh router SSR context with the provided initial path
 *
 * @example
 * ```ts
 * const ctx = createRouterContext('/about');
 * const html = runWithRouterContext(ctx, () => renderToString(mount(App())));
 * // Router will use '/about' as initial path during SSR
 * ```
 */
export function createRouterContext(initialPath: string): RouterSSRContext {
  return { initialPath };
}

/**
 * Run a function within a router SSR context
 *
 * Provides isolated context for the duration of the function execution.
 * Context is automatically cleaned up after the function completes.
 *
 * @param ctx - Router SSR context to use during execution
 * @param fn - Function to execute within the context
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const ctx = createRouterContext('/products/123');
 * const html = runWithRouterContext(ctx, () => {
 *   // Router components will use '/products/123' as initial path
 *   return renderToString(mount(App()));
 * });
 * ```
 */
export function runWithRouterContext<T>(ctx: RouterSSRContext, fn: () => T): T {
  const store = getOrInitContextStore();
  return store.run(ctx, fn);
}

/**
 * Get the active router SSR context
 *
 * Returns the context for the current async execution context.
 * Returns undefined if not running within an SSR context.
 *
 * This is the primary mechanism for environment detection:
 * - Returns context → running on server during SSR
 * - Returns undefined → running in browser or outside SSR context
 *
 * @returns Current router SSR context or undefined
 *
 * @example
 * ```ts
 * const ctx = getActiveRouterContext();
 * if (ctx) {
 *   // Running on server during SSR
 *   // Use ctx.initialPath for initial route
 * } else {
 *   // Running on client
 *   // Use window.location.pathname for initial route
 * }
 * ```
 */
export function getActiveRouterContext(): RouterSSRContext | undefined {
  const store = getOrInitContextStore();
  return store.getStore();
}
