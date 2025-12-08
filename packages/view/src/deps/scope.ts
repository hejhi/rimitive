import type { RenderScope } from '../types';
import { defineModule } from '@lattice/lattice';
import { EffectModule } from '@lattice/signals/effect';

// Status constants for RenderScope disposal tracking
// Note: RenderScope is not a reactive node - these are just for lifecycle management
const CLEAN = 0;
const DISPOSED = 1 << 2; // Bit 2: disposed state
const RENDER_SCOPE_CLEAN = CLEAN;

/**
 * Public scope API for managing element lifecycles and cleanup.
 *
 * @example
 * ```typescript
 * import { createScopes, type CreateScopes } from '@lattice/view/deps/scope';
 *
 * const scopes: CreateScopes = createScopes({ baseEffect: effect });
 *
 * // Use in element creation
 * const scope = scopes.createElementScope(element, () => {
 *   scopes.scopedEffect(() => {
 *     console.log('Reactive effect');
 *   });
 *   scopes.onCleanup(() => {
 *     console.log('Cleanup when element is removed');
 *   });
 * });
 * ```
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

  /**
   * Get the scope associated with an element, if one exists.
   * Used during disposal to look up scopes when removing elements.
   */
  getElementScope: <TElement extends object>(
    element: TElement
  ) => RenderScope<TElement> | undefined;
};

/**
 * Creates scope management utilities for element lifecycles and cleanup
 *
 * @example
 * ```typescript
 * import { createScopes } from '@lattice/view/deps/scope';
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const { effect } = createSignals();
 * const { createElementScope, scopedEffect, onCleanup, disposeScope } = createScopes({
 *   baseEffect: effect
 * });
 *
 * // Create a scope for an element
 * const element = document.createElement('div');
 * const scope = createElementScope(element, () => {
 *   scopedEffect(() => {
 *     console.log('This runs reactively');
 *     onCleanup(() => console.log('Cleanup on scope disposal'));
 *   });
 * });
 *
 * // Later, dispose the scope
 * if (scope) disposeScope(scope);
 * ```
 */
export function createScopes({
  baseEffect,
}: {
  baseEffect: (fn: () => void | (() => void)) => () => void;
}): CreateScopes {
  // Element-to-scope mapping for disposal lookup
  const elementScopes = new WeakMap<object, RenderScope<object>>();
  let activeScope: RenderScope<object> | null = null;

  /**
   * Dispose a RenderScope and all its children/disposables
   *
   * Single-pass DFS with descent/unwind phases (inspired by pull-propagator pattern):
   * - Descent: Mark as disposed, descend into children
   * - Unwind: Cleanup disposables when returning from children
   * - Stack tracks both parent and sibling continuations
   */
  const disposeScope = <TElement = object>(
    rootScope: RenderScope<TElement>
  ): void => {
    // Already disposed (idempotent)
    if (rootScope.status & DISPOSED) return;

    // Stack node: tracks parent (for cleanup) and next sibling (for traversal)
    type StackNode = {
      parent: RenderScope<TElement>; // Parent to cleanup after all children done
      nextSibling: RenderScope<TElement> | undefined; // Next sibling to process
      prev: StackNode | undefined;
    };

    let stack: StackNode | undefined;
    let scope = rootScope;

    // DESCENT PHASE: Walk down the tree marking nodes as disposed
    descent: for (;;) {
      // Mark as disposed
      if (!(scope.status & DISPOSED)) {
        scope.status |= DISPOSED;

        // Descend into children
        const firstChild = scope.firstChild;
        if (firstChild !== undefined) {
          // Push parent to stack (will cleanup after all children done)
          stack = {
            parent: scope,
            nextSibling: firstChild.nextSibling,
            prev: stack,
          };

          scope = firstChild;
          continue descent;
        }
      }

      // UNWIND PHASE: Cleanup when no children or children already processed
      for (;;) {
        // Dispose all tracked disposables
        let node = scope.firstDisposable;
        while (node) {
          node.dispose();
          node = node.next;
        }

        // Clear references
        scope.firstChild = undefined;
        scope.firstDisposable = undefined;

        // Remove from elementScopes map
        elementScopes.delete(scope.element as object);

        // Done if we've returned to root and no more siblings
        if (scope === rootScope) return;

        // Pop from stack to get parent and next sibling
        if (stack !== undefined) {
          const { parent, nextSibling, prev } = stack;
          stack = prev;

          // Process next sibling if exists
          if (nextSibling !== undefined) {
            // Re-push parent since we're not done with all its children
            stack = {
              parent,
              nextSibling: nextSibling.nextSibling,
              prev: stack,
            };
            scope = nextSibling;
            continue descent;
          }

          // All siblings done, now cleanup parent
          scope = parent;
          continue;
        }

        // No more work
        return;
      }
    }
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
    const parentScope = activeScope;

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

    const prevScope = activeScope;
    activeScope = scope;

    fn();

    activeScope = prevScope;

    // CRITICAL: Only keep scope if it has disposables
    // Otherwise unlink from parent tree to avoid traversal overhead
    if (scope.firstDisposable !== undefined) {
      elementScopes.set(element, scope);
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
    const scope = activeScope;

    // Track the dispose function in the current scope
    if (scope) scope.firstDisposable = { dispose, next: scope.firstDisposable };

    return dispose;
  };

  /**
   * Register a cleanup function to run when the current scope is disposed.
   * Must be called within a scope context (e.g., inside element setup).
   */
  const onCleanup = (cleanup: () => void): void => {
    const scope = activeScope;
    if (!scope) return;

    // Track cleanup directly in active scope
    scope.firstDisposable = { dispose: cleanup, next: scope.firstDisposable };
  };

  /**
   * Get the scope associated with an element, if one exists
   */
  const getElementScope = <TElem extends object>(
    element: TElem
  ): RenderScope<TElem> | undefined => {
    return elementScopes.get(element) as RenderScope<TElem> | undefined;
  };

  return {
    disposeScope,
    createElementScope,
    scopedEffect,
    onCleanup,
    getElementScope,
  };
}

/**
 * Scopes module - provides element lifecycle and cleanup management.
 * Depends on EffectModule for the underlying reactive effect.
 */
export const ScopesModule = defineModule({
  name: 'scopes',
  dependencies: [EffectModule],
  create: ({ effect }) => createScopes({ baseEffect: effect }),
});
