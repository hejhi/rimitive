/**
 * ViewContext provides infrastructure for view lifecycle management.
 * Maps elements to their scopes for efficient lookup during reconciliation.
 *
 * Note: Version tracking is handled by the signals infrastructure
 * (signalsCtx.trackingVersion and node.trackingVersion on each ConsumerNode/RenderScope).
 * The active scope for hierarchy management is handled locally by createScopes()
 * as a closure variable, since it's only needed internally.
 */

import type { RenderScope } from './types';

/**
 * View lifecycle management context
 */
export interface ViewContext<TElement extends object> {
  /**
   * Map element to its render scope
   */
  elementScopes: WeakMap<TElement, RenderScope<TElement>>;
}

/**
 * Create a new ViewContext instance
 *
 * This should be called once per rendering context (e.g., per SSR request, per client app)
 * to ensure isolation and enable concurrent rendering.
 */
export function createBaseContext<TElement extends object>(): ViewContext<TElement> {
  return {
    elementScopes: new WeakMap(),
  };
}
