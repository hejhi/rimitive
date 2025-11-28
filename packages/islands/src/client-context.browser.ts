/**
 * Client Context - Browser version
 *
 * Stores the reactive request context getter for client-side islands.
 * Set by the SSR client preset after creating the router.
 */

import type { RequestContext } from './types';

/**
 * Module-level storage for the client request context getter
 */
let clientRequestGetter: (() => RequestContext) | undefined;

/**
 * Get the active client request context getter
 *
 * Returns a function that, when called, returns the current RequestContext.
 * This is reactive - calling the getter will track dependencies.
 */
export function getClientRequestContext(): (() => RequestContext) | undefined {
  return clientRequestGetter;
}

/**
 * Set the client request context getter
 *
 * Called by the SSR client preset after creating the router.
 * The getter should return the current request context reactively.
 */
export function setClientRequestContext(
  getter: () => RequestContext
): void {
  clientRequestGetter = getter;
}
