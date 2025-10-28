/**
 * Register a cleanup function to run when the current scope is disposed.
 *
 * This is a convenience helper that tracks cleanup in the active scope.
 * Must be called within a scope context (e.g., inside withScope or element setup).
 *
 * @example
 * withScope(element, () => {
 *   const timer = setInterval(() => {...}, 1000);
 *   onCleanup(() => clearInterval(timer));
 * });
 */

import type { LatticeContext } from '../context';

export function createOnCleanup(ctx: LatticeContext) {
  return function onCleanup(cleanup: () => void): void {
    const scope = ctx.activeScope;
    if (!scope) {
      // Could warn in dev mode that onCleanup was called outside a scope
      return;
    }

    // Track cleanup directly in active scope
    scope.firstDisposable = {
      dispose: cleanup,
      next: scope.firstDisposable,
    };
  };
}
