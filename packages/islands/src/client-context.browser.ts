/**
 * Client Context - Browser version
 *
 * Stores the reactive context getter for client-side islands.
 * Set by the SSR client preset.
 */

import type { GetContext } from './types';

/**
 * Module-level storage for the client context getter
 */
let clientContextGetter: GetContext<unknown> | undefined;

/**
 * Get the active client context getter
 *
 * Returns a function that, when called, returns the current context.
 * This is reactive - calling the getter will track dependencies.
 */
export function getClientContext(): GetContext<unknown> | undefined {
  return clientContextGetter;
}

/**
 * Set the client context getter
 *
 * Called by the SSR client preset.
 * The getter should return the current context reactively.
 */
export function setClientContext<TContext>(
  getter: GetContext<TContext>
): void {
  clientContextGetter = getter as GetContext<unknown>;
}
