/**
 * SSR Context Management
 *
 * Uses AsyncLocalStorage to track islands during server-side rendering.
 * Each request gets its own isolated context, preventing state leakage.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { SSRContext } from './types';

/**
 * AsyncLocalStorage instance for SSR context
 * Provides request isolation - each render gets its own context
 */
const ssrContextStore = new AsyncLocalStorage<SSRContext>();

/**
 * Create a new SSR context
 *
 * @returns Fresh SSR context with empty islands array and counter at 0
 *
 * @example
 * ```ts
 * const ctx = createSSRContext();
 * const html = runWithSSRContext(ctx, () => renderToString(mount(App())));
 * console.log(ctx.islands); // Islands discovered during render
 * ```
 */
export function createSSRContext(): SSRContext {
  return {
    islands: [],
    islandCounter: 0,
  };
}

/**
 * Run a function within an SSR context
 *
 * Provides isolated context for the duration of the function execution.
 * Context is automatically cleaned up after the function completes.
 *
 * @param ctx - SSR context to use during execution
 * @param fn - Function to execute within the context
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const ctx = createSSRContext();
 * const html = runWithSSRContext(ctx, () => {
 *   // Island components will register in ctx.islands
 *   return renderToString(mount(App()));
 * });
 * ```
 */
export function runWithSSRContext<T>(ctx: SSRContext, fn: () => T): T {
  return ssrContextStore.run(ctx, fn);
}

/**
 * Get the active SSR context
 *
 * Returns the context for the current async execution context.
 * Returns undefined if not running within an SSR context.
 *
 * @returns Current SSR context or undefined
 *
 * @example
 * ```ts
 * const ctx = getActiveSSRContext();
 * if (ctx) {
 *   // Running on server during SSR
 *   ctx.islands.push({ id: 'counter-0', type: 'counter', props: {} });
 * } else {
 *   // Running on client or outside SSR context
 * }
 * ```
 */
export function getActiveSSRContext(): SSRContext | undefined {
  return ssrContextStore.getStore();
}

/**
 * Generate inline hydration scripts for collected islands
 *
 * Emits <script> tags that call window.__hydrate for each island.
 * These scripts run immediately when encountered, starting hydration.
 *
 * @param ctx - SSR context containing islands
 * @returns HTML string with inline script tags
 *
 * @example
 * ```ts
 * const ctx = createSSRContext();
 * const html = runWithSSRContext(ctx, () => renderToString(mount(App())));
 * const scripts = getIslandScripts(ctx);
 * // Returns: <script>window.__hydrate("counter-0","counter",{"count":5});</script>...
 * ```
 */
export function getIslandScripts(ctx: SSRContext): string {
  return ctx.islands
    .map((island) => {
      // Escape JSON for safe embedding in script tag
      const propsJson = JSON.stringify(island.props)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');

      return `<script>window.__hydrate("${island.id}","${island.type}",${propsJson});</script>`;
    })
    .join('\n');
}

/**
 * Register an island in the active SSR context
 *
 * Called by the island() wrapper during server-side rendering.
 * Generates a unique instance ID and adds to context.
 *
 * @param type - Island type (e.g., "counter")
 * @param props - Island props (must be JSON-serializable)
 * @returns Unique instance ID (e.g., "counter-0")
 *
 * @internal
 */
export function registerIsland(type: string, props: unknown): string {
  const ctx = getActiveSSRContext();
  if (!ctx) {
    throw new Error(
      `Cannot register island "${type}" outside of SSR context. ` +
      `Did you forget to wrap your render in runWithSSRContext()?`
    );
  }

  const instanceId = `${type}-${ctx.islandCounter++}`;
  ctx.islands.push({ id: instanceId, type, props });

  return instanceId;
}
