/**
 * Scope-aware effect that automatically tracks itself in the active scope
 *
 * This eliminates manual trackInScope calls by making effects lifecycle-aware.
 * When an effect is created within a scope, it's automatically tracked for disposal.
 */

import type { LatticeContext } from '../context';

export interface ScopedEffectOpts {
  ctx: LatticeContext;
  baseEffect: (fn: () => void | (() => void)) => () => void;
}

/**
 * Create a scope-aware effect factory
 *
 * Effects created by this factory are automatically tracked in the current
 * activeScope (if any), eliminating manual trackInScope calls.
 *
 * Usage:
 *   const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });
 *
 *   withElementScope(element, () => {
 *     scopedEffect(() => { ... }); // Auto-tracked in element's scope
 *   });
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
      // This uses the same pattern as trackInScope, but encapsulated
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
