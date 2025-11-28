/**
 * Client Context - Server version (stub)
 *
 * Server-side stub that returns undefined.
 * The real client context only exists in the browser.
 */

import type { RequestContext } from './types';

/**
 * Get the active client request context
 *
 * On server: always returns undefined
 */
export function getClientRequestContext(): (() => RequestContext) | undefined {
  return undefined;
}

/**
 * Set the client request context getter
 *
 * On server: no-op
 */
export function setClientRequestContext(
  _getter: () => RequestContext
): void {
  void _getter;
  // No-op on server
}
