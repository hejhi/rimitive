/**
 * SSR Context Management
 *
 * Uses AsyncLocalStorage to track islands during server-side rendering.
 * Each request gets its own isolated context, preventing state leakage.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { SSRContext, RequestContext } from './types';

/**
 * AsyncLocalStorage instance for SSR context
 * Provides request isolation - each render gets its own context
 */
const ssrContextStore = new AsyncLocalStorage<SSRContext>();

/**
 * Options for creating SSR context
 */
export interface SSRContextOptions {
  /**
   * Request context (URL) for the current request
   * Made available to islands via context.request()
   */
  request?: RequestContext | URL | string;
}

/**
 * Normalize request input to RequestContext
 */
function normalizeRequest(
  input: RequestContext | URL | string | undefined
): RequestContext | undefined {
  if (!input) return undefined;

  // Already a RequestContext
  if (typeof input === 'object' && 'pathname' in input && 'searchParams' in input) {
    return input as RequestContext;
  }

  // URL object or string
  const url = typeof input === 'string' ? new URL(input, 'http://localhost') : input;

  return {
    url,
    pathname: url.pathname,
    search: url.search,
    searchParams: url.searchParams,
  };
}

/**
 * Create a new SSR context
 *
 * @param options - Optional configuration including request context
 */
export function createSSRContext(options?: SSRContextOptions): SSRContext {
  return {
    islands: [],
    islandCounter: 0,
    request: normalizeRequest(options?.request),
  };
}

/**
 * Run a function within an SSR context
 *
 * Provides isolated context for the duration of the function execution.
 * Context is automatically cleaned up after the function completes.
 */
export function runWithSSRContext<T>(ctx: SSRContext, fn: () => T): T {
  return ssrContextStore.run(ctx, fn);
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
 * Generate inline hydration scripts for collected islands
 *
 * Emits <script> tags that call window.__hydrate for each island.
 * These scripts run immediately when encountered, starting hydration.
 */
export function getIslandScripts(ctx: SSRContext): string {
  return ctx.islands
    .map((island) => {
      // Escape JSON for safe embedding in script tag
      const propsJson = JSON.stringify(island.props)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');

      return `<script>window.__hydrate("${island.id}","${island.type}",${propsJson},${island.status});</script>`;
    })
    .join('\n');
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
