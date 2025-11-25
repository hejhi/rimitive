/**
 * Browser-safe stub for SSR context
 *
 * In browser environments, SSR context is always undefined
 * This stub prevents bundling Node.js-specific code (async_hooks) in the client bundle
 */

export interface RouterSSRContext {
  initialPath: string;
}

export function createRouterContext(): RouterSSRContext {
  throw new Error('createRouterContext should not be called in browser');
}

export function runWithRouterContext<T>(
  _ctx: RouterSSRContext,
  fn: () => T
): T {
  return fn();
}

export function getActiveRouterContext(): RouterSSRContext | undefined {
  // Always return undefined in browser - we're not in an SSR context
  return undefined;
}
