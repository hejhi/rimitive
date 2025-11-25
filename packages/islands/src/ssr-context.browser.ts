/**
 * SSR Context - Browser version
 *
 * Browser-safe stub that prevents bundling Node.js-specific code (async_hooks).
 * In browser environments, SSR context is always undefined since we're not
 * in a server-side rendering context.
 */

import type { SSRContext } from './types';

/**
 * Create a new SSR context
 *
 * In browser: throws an error since this shouldn't be called client-side
 */
export function createSSRContext(): SSRContext {
  throw new Error('createSSRContext should not be called in browser');
}

/**
 * Run a function within an SSR context
 *
 * In browser: just runs the function directly (no context needed)
 */
export function runWithSSRContext<T>(_ctx: SSRContext, fn: () => T): T {
  return fn();
}

/**
 * Get the active SSR context
 *
 * In browser: always returns undefined since we're not in SSR
 */
export function getActiveSSRContext(): SSRContext | undefined {
  return undefined;
}

/**
 * Generate inline hydration scripts for collected islands
 *
 * In browser: returns empty string (scripts are for server-rendered HTML)
 */
export function getIslandScripts(_ctx: SSRContext): string {
  return '';
}

/**
 * Register an island in the active SSR context
 *
 * In browser: returns empty string (registration happens server-side)
 */
export function registerIsland(_type: string, _props: unknown): string {
  return '';
}
