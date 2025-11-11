import type { RenderScope } from '../types';
import type { ViewContext } from '../context';
import { CONSTANTS } from '@lattice/signals/constants';

const { CLEAN, CONSUMER, DISPOSED, STATE_MASK } = CONSTANTS;

// Status combination for render scopes (consumer + clean)
// Note: Not marked as SCHEDULED since RenderScopes don't implement reactive flush behavior
const RENDER_SCOPE_CLEAN = CONSUMER | CLEAN;

/**
 * Public scope API for managing element lifecycles and cleanup.
 */
export type CreateScopes = {
  /**
   * Dispose a scope and all its children/disposables.
   * Used by reconciliation logic when elements are removed.
   */
  disposeScope: <TElement = object>(scope: RenderScope<TElement>) => void;

  /**
   * Fast path for element creation - skips idempotency checks.
   * Use this when you know the element is brand new (e.g., in el.create()).
   * Performance optimized: no WeakMap lookup, no return value allocation, no try/catch.
   */
  createElementScope: <TElement extends object = object>(
    element: TElement,
    fn: () => void
  ) => RenderScope<TElement> | null;

  /**
   * Create a scope-aware effect that auto-tracks itself in activeScope.
   */
  scopedEffect: (fn: () => void | (() => void)) => () => void;

  /**
   * Register a cleanup function to run when the current scope is disposed.
   * Must be called within a scope context (e.g., inside element setup).
   */
  onCleanup: (cleanup: () => void) => void;
};

export function createScopes<TElement extends object>({
  ctx,
  baseEffect,
}: {
  ctx: ViewContext<TElement>;
  baseEffect: (fn: () => void | (() => void)) => () => void;
}): CreateScopes {
  // Cast ctx to handle any object type at runtime
  const anyCtx = ctx as ViewContext<object>;

  /**
   * Dispose a RenderScope and all its children/disposables
   *
   * This implements a layered disposal strategy that integrates the reactive graph
   * (signals) with the view tree structure.
   */
  const disposeScope = <TElement = object>(
    scope: RenderScope<TElement>
  ): void => {
    // Already disposed (idempotent)
    if ((scope.status & STATE_MASK) === DISPOSED) return;

    // Mark as disposed
    scope.status = (scope.status & ~STATE_MASK) | DISPOSED;

    // Dispose all child scopes recursively (tree structure)
    let child = scope.firstChild;
    while (child) {
      const next = child.nextSibling;
      disposeScope(child);
      child = next;
    }

    // Dispose all tracked disposables (lifecycle tracking)
    let node = scope.firstDisposable;
    while (node) {
      node.dispose();
      node = node.next;
    }

    // Clear references
    scope.firstChild = undefined;
    scope.firstDisposable = undefined;

    // Remove from elementScopes map (centralized cleanup)
    anyCtx.elementScopes.delete(scope.element as object);
  };

  /**
   * Fast path for element creation - skips idempotency checks
   * Use this when you know the element is brand new (e.g., in el.create())
   *
   * Performance optimizations:
   * - No WeakMap.get() lookup (elements are always new)
   * - No object allocation for return value
   * - No try/catch overhead
   * - Inlined scope creation (no function call overhead)
   * - Returns null and unlinks scope if no disposables (avoids tree traversal overhead)
   */
  const createElementScope = <TElem extends object = object>(
    element: TElem,
    fn: () => void
  ): RenderScope<TElem> | null => {
    // Use activeScope as parent for automatic hierarchy
    const parentScope = anyCtx.activeScope;

    // Inline scope creation - combines status tracking with tree structure (Scope)
    const scope: RenderScope<TElem> = {
      // Type marker and status
      __type: 'render-scope',
      status: RENDER_SCOPE_CLEAN,

      // Tree structure (from Scope)
      firstChild: undefined,
      nextSibling: undefined,

      // Lifecycle & cleanup (from Scope)
      firstDisposable: undefined,

      // Element binding
      element,
    };

    // Attach to parent's child list
    if (parentScope) {
      scope.nextSibling = parentScope.firstChild as
        | RenderScope<TElem>
        | undefined;
      parentScope.firstChild = scope as RenderScope<object>;
    }

    const prevScope = anyCtx.activeScope;
    anyCtx.activeScope = scope;

    fn();

    anyCtx.activeScope = prevScope;

    // CRITICAL: Only keep scope if it has disposables
    // Otherwise unlink from parent tree to avoid traversal overhead
    if (scope.firstDisposable !== undefined) {
      anyCtx.elementScopes.set(element, scope);
      return scope;
    }

    // No disposables - unlink from parent to avoid tree traversal overhead
    if (parentScope && parentScope.firstChild === scope) {
      parentScope.firstChild = scope.nextSibling;
    }

    return null;
  };

  /**
   * Create a scope-aware effect that automatically tracks itself in activeScope
   */
  const scopedEffect = (fn: () => void | (() => void)): (() => void) => {
    // Create the underlying effect
    const dispose = baseEffect(fn);

    // Auto-track in current scope if one is active
    const scope = anyCtx.activeScope;

    // Track the dispose function in the current scope
    if (scope) scope.firstDisposable = { dispose, next: scope.firstDisposable };

    return dispose;
  };

  /**
   * Register a cleanup function to run when the current scope is disposed.
   * Must be called within a scope context (e.g., inside element setup).
   */
  const onCleanup = (cleanup: () => void): void => {
    const scope = anyCtx.activeScope;
    if (!scope) return;

    // Track cleanup directly in active scope
    scope.firstDisposable = { dispose: cleanup, next: scope.firstDisposable };
  };

  return {
    disposeScope,
    createElementScope,
    scopedEffect,
    onCleanup,
  };
}
