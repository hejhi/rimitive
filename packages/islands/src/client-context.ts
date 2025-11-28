/**
 * Client Context - Server version (stub)
 *
 * Server-side stub that returns undefined.
 * The real client context only exists in the browser.
 */

import type { GetContext } from './types';

/**
 * Get the active client context
 *
 * On server: always returns undefined
 */
export function getClientContext(): GetContext<unknown> | undefined {
  return undefined;
}

/**
 * Set the client context getter
 *
 * On server: no-op
 */
export function setClientContext<TContext>(
  _getter: GetContext<TContext>
): void {
  void _getter;
  // No-op on server
}
