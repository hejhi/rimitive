/**
 * View context for concurrency-safe scope tracking
 *
 * Context-scoped state (like signals GlobalContext)
 * All per-request state lives here, not in global module variables.
 * This enables concurrent SSR - each request gets its own context.
 */

import type { Scope } from './helpers/scope';

export interface ViewContext {
  /**
   * Current active scope for tracking disposables
   */
  currentScope: Scope | null;

  /**
   * Map element to its scope
   * Minimal external storage (like signals ctx)
   * This is the only lookup needed - everything else is algorithmic
   */
  elementScopes: WeakMap<object, Scope>;
}

export function createViewContext(): ViewContext {
  return {
    currentScope: null,
    elementScopes: new WeakMap(),
  };
}
