/**
 * High-level scope management that eliminates manual orchestration
 *
 * This provides a declarative API for scope creation and management,
 * replacing the imperative pattern of:
 *   1. createScope()
 *   2. ctx.elementScopes.set()
 *   3. runInScope()
 *   4. ctx.elementScopes.delete() if empty
 *
 * With a single call:
 *   withScope(element, () => { ... })
 */

import type { LatticeContext } from '../context';
import type { RenderScope } from '../types';
import type { CreateScopes } from './scope';

export interface WithScopeOpts {
  ctx: LatticeContext;
  createScope: CreateScopes['createScope'];
}

/**
 * Create a withScope helper
 *
 * This factory returns a function that handles the full lifecycle:
 * - Creates scope
 * - Registers in elementScopes
 * - Sets as activeScope
 * - Runs code
 * - Cleans up if no disposables were tracked
 */
export function createWithScope(opts: WithScopeOpts) {
  const { ctx, createScope } = opts;

  /**
   * Run code within a new scope attached to an element
   *
   * This eliminates the manual orchestration pattern:
   *
   * BEFORE:
   *   const scope = createScope(element);
   *   ctx.elementScopes.set(element, scope);
   *   runInScope(scope, () => {
   *     // setup code
   *   });
   *   if (scope.firstDisposable === undefined) {
   *     ctx.elementScopes.delete(element);
   *   }
   *
   * AFTER:
   *   withScope(element, () => {
   *     // setup code
   *   });
   *
   * Returns the created scope so callers can access it if needed.
   */
  return function withScope<TElement = object, T = void>(
    element: TElement,
    fn: (scope: RenderScope<TElement>) => T,
    parent?: RenderScope
  ): { result: T; scope: RenderScope<TElement> } {
    // Create scope
    const scope = createScope(element, parent);

    // Register so children/effects can find it
    ctx.elementScopes.set(element, scope);

    // Set as active scope and run code
    const prevScope = ctx.activeScope;
    ctx.activeScope = scope as RenderScope;

    let result: T;
    try {
      result = fn(scope);
    } finally {
      ctx.activeScope = prevScope;
    }

    // Clean up registration if no disposables were tracked
    // (Lazy optimization - elements with no reactive props don't need scopes)
    if (scope.firstDisposable === undefined && scope.renderFn === undefined) {
      ctx.elementScopes.delete(element);
    }

    return { result, scope };
  };
}

/**
 * Variant that only runs code in an existing element's scope
 *
 * This is useful for fragments/map that want to attach to parent scope
 * without creating their own.
 */
export function createWithElementScope(opts: { ctx: LatticeContext }) {
  const { ctx } = opts;

  return function withElementScope<T>(
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
  };
}
