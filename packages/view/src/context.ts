/**
 * LatticeContext unifies the context requirements from both @lattice/signals and @lattice/view.
 * This creates a single context that:
 * 1. Tracks the active scope for reactive dependency tracking (from signals' GlobalContext.consumerScope)
 * 2. Manages view lifecycle and cleanup through scope tracking (from view's ViewContext.currentScope)
 * 3. Provides version tracking for change detection (from signals' GlobalContext.trackingVersion)
 * 4. Maps elements to their scopes for efficient lookup (from view's ViewContext.elementScopes)
 */

import type { RenderScope } from './types';

/**
 * Combines reactive tracking (signals) with view lifecycle management (view)
 */
export interface LatticeContext<TElement extends object> {
  /**
   * Active scope for reactive tracking and lifecycle management
   */
  activeScope: RenderScope<TElement> | null;

  /**
   * Global version counter for change detection
   *
   * Incremented on each reactive update cycle to detect stale dependencies.
   */
  trackingVersion: number;

  /**
   * Map element to its render scope
   */
  elementScopes: WeakMap<TElement, RenderScope<TElement>>;
}

/**
 * Create a new LatticeContext instance
 *
 * This should be called once per rendering context (e.g., per SSR request, per client app)
 * to ensure isolation and enable concurrent rendering.
 */
export function createLatticeContext<TElement extends object>(): LatticeContext<TElement> {
  return {
    activeScope: null,
    trackingVersion: 0,
    elementScopes: new WeakMap(),
  };
}
