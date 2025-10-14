/**
 * View context for concurrency-safe scope tracking
 *
 * PATTERN: Context-scoped state (like signals GlobalContext)
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
   * Map element to its scope (for disposal)
   */
  elementScopes: WeakMap<object, Scope>;

  /**
   * Map element to its dispose callback
   */
  elementDisposeCallbacks: WeakMap<object, () => void>;

  /**
   * Map element to cleanup callbacks from lifecycle
   */
  elementCleanupCallbacks: WeakMap<object, () => void>;
}

export function createViewContext(): ViewContext {
  return {
    currentScope: null,
    elementScopes: new WeakMap(),
    elementDisposeCallbacks: new WeakMap(),
    elementCleanupCallbacks: new WeakMap(),
  };
}
