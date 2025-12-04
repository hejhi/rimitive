/**
 * SSR Context Management
 *
 * Uses AsyncLocalStorage to track islands during server-side rendering.
 * Each request gets its own isolated context, preventing state leakage.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { SSRContext, GetContext } from './types';

/**
 * AsyncLocalStorage instance for SSR context
 * Provides request isolation - each render gets its own context
 */
const ssrContextStore = new AsyncLocalStorage<SSRContext>();

/**
 * Options for creating SSR context
 */
export type SSRContextOptions<TContext = unknown> = {
  /**
   * Context getter for islands
   * Called by islands to get user-defined context
   */
  getContext?: GetContext<TContext>;
};

/**
 * Create a new SSR context
 *
 * @param options - Optional configuration including context getter
 */
export function createSSRContext<TContext = unknown>(
  options?: SSRContextOptions<TContext>
): SSRContext<TContext> {
  return {
    islands: [],
    islandCounter: 0,
    getContext: options?.getContext,
  };
}

/**
 * Run a function within an SSR context
 *
 * Provides isolated context for the duration of the function execution.
 * Context is automatically cleaned up after the function completes.
 */
export function runWithSSRContext<T, TContext = unknown>(
  ctx: SSRContext<TContext>,
  fn: () => T
): T {
  return ssrContextStore.run(ctx as SSRContext, fn);
}

/**
 * Get the active SSR context
 *
 * Returns the context for the current async execution context.
 * Returns undefined if not running within an SSR context.
 */
export function getActiveSSRContext(): SSRContext | undefined {
  return ssrContextStore.getStore();
}

/**
 * Generate hydration scripts for collected islands.
 *
 * Includes the bootstrap script (sets up queue) followed by
 * individual island hydration calls. Returns empty string if no islands.
 */
export function getIslandScripts(ctx: SSRContext): string {
  if (ctx.islands.length === 0) return '';

  const bootstrap = `<script>
window.__islands = [];
window.__hydrate = (id, type, props, status) => __islands.push({ id, type, props, status });
</script>`;

  const islandScripts = ctx.islands
    .map((island) => {
      // Escape JSON for safe embedding in script tag
      const propsJson = JSON.stringify(island.props)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');

      return `<script>window.__hydrate("${island.id}","${island.type}",${propsJson},${island.status});</script>`;
    })
    .join('\n');

  return `${bootstrap}\n${islandScripts}`;
}

/**
 * Register an island in the active SSR context
 *
 * Called by the island() wrapper during server-side rendering.
 * Generates a unique instance ID and adds to context.
 *
 * @param type - Island type identifier
 * @param props - Props passed to the island component
 * @param status - Node status (STATUS_ELEMENT=1, STATUS_FRAGMENT=2)
 */
export function registerIsland(
  type: string,
  props: unknown,
  status: number
): string {
  const ctx = getActiveSSRContext();
  if (!ctx) {
    throw new Error(
      `Cannot register island "${type}" outside of SSR context. ` +
        `Did you forget to wrap your render in runWithSSRContext()?`
    );
  }

  const instanceId = `${type}-${ctx.islandCounter++}`;
  ctx.islands.push({ id: instanceId, type, props, status });

  return instanceId;
}
