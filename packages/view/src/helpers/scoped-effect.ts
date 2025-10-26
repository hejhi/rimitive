/**
 * Scope-aware effect that automatically tracks itself in the active scope
 * When an effect is created within a scope, it's automatically tracked for disposal.
 */

import type { LatticeContext } from '../context';

export interface ScopedEffectOpts {
  ctx: LatticeContext;
  baseEffect: (fn: () => void | (() => void)) => () => void;
}

/**
 * Create a scope-aware effect factory
 */
export function createScopedEffect(opts: ScopedEffectOpts) {
  const { ctx, baseEffect } = opts;

  return function scopedEffect(fn: () => void | (() => void)): () => void {
    // Create the underlying effect
    const dispose = baseEffect(fn);

    // Auto-track in current scope if one is active
    const scope = ctx.activeScope;
    if (scope) {
      // Track the dispose function in the current scope
      const node = {
        disposable: { dispose },
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    }

    return dispose;
  };
}

/**
 * Helper to run code within an element's scope context
 *
 * This abstracts the pattern of:
 * 1. Looking up scope from elementScopes
 * 2. Setting activeScope
 * 3. Running code
 * 4. Restoring previous scope
 */
export function withElementScope<T>(
  ctx: LatticeContext,
  element: object,
  fn: () => T
): T {
  const scope = ctx.elementScopes.get(element);
  if (!scope) {
    // No scope exists - just run the function
    return fn();
  }

  const prevScope = ctx.activeScope;
  ctx.activeScope = scope;
  try {
    return fn();
  } finally {
    ctx.activeScope = prevScope;
  }
}
