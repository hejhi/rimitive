import type { RenderScope } from '../types';
import type { LatticeContext } from '../context';
import type { GraphEdges } from '@lattice/signals/helpers/graph-edges';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import { CONSTANTS } from '@lattice/signals/constants';

const { CLEAN, CONSUMER, SCHEDULED, DISPOSED, STATE_MASK } = CONSTANTS;

// Status combination for render scopes (consumer + scheduled + clean)
const RENDER_SCOPE_CLEAN = CONSUMER | SCHEDULED | CLEAN;

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
   * Run code within a scope attached to an element.
   * If a scope already exists for the element, reuses it (idempotent).
   * Otherwise creates a new scope, using ctx.activeScope as parent for hierarchy.
   * Handles full lifecycle: creation, registration, activation, and cleanup.
   */
  withScope: <TElement extends object = object, T = void>(
    element: TElement,
    fn: (scope: RenderScope<TElement>) => T
  ) => { result: T; scope: RenderScope<TElement> | null };

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
   * Must be called within a scope context (e.g., inside withScope or element setup).
   */
  onCleanup: (cleanup: () => void) => void;
};

export function createScopes<TElement extends object>({
  ctx,
  track,
  dispose: disposeNode,
  baseEffect,
}: {
  ctx: LatticeContext<TElement>;
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
  baseEffect: (fn: () => void | (() => void)) => () => void;
}): CreateScopes {
  // Cast ctx to handle any object type at runtime
  const anyCtx = ctx as unknown as LatticeContext<object>;
  /**
   * Create a new RenderScope instance
   * Combines reactive graph node (ScheduledNode) with tree structure (Scope)
   */
  const createScope = <TElem = TElement>(
    element: TElem,
    parent?: RenderScope<TElem> | null,
    renderFn?: () => void | (() => void)
  ): RenderScope<TElem> => {
    const scope: RenderScope<TElem> = {
      // Reactive graph fields (from ScheduledNode -> ConsumerNode -> ReactiveNode)
      __type: 'render-scope',
      status: RENDER_SCOPE_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      nextScheduled: undefined,

      // Flush method - re-runs render function with reactive tracking
      // When signals change, scheduler marks this scope DIRTY and queues for flush
      flush(): void {
        if (scope.renderFn === undefined) return;

        const { cleanup } = scope;

        // Clear previous cleanup
        if (cleanup) {
          cleanup();
          scope.cleanup = undefined;
        }

        // Re-run render with dependency tracking
        // track() establishes edges from signals to this scope
        const result = track(scope, scope.renderFn);

        // Store cleanup function if returned
        if (typeof result === 'function') scope.cleanup = result;
      },

      // Tree structure (from Scope)
      firstChild: undefined,
      nextSibling: undefined,

      // Lifecycle & cleanup (from Scope)
      firstDisposable: undefined,

      // Element binding
      element,
      cleanup: undefined,

      // Reactive rendering
      renderFn,
    };

    // Attach to parent's child list
    if (parent) {
      scope.nextSibling = parent.firstChild;
      parent.firstChild = scope;
    }

    // Initial flush if renderFn provided - establishes initial dependencies
    if (renderFn) scope.flush();

    return scope;
  };

  /**
   * Dispose a RenderScope and all its children/disposables
   *
   * This implements a layered disposal strategy that integrates the reactive graph
   * (signals) with the view tree structure.
   */
  const disposeScope = <TElement = object>(scope: RenderScope<TElement>): void => {
    // Already disposed (idempotent)
    if ((scope.status & STATE_MASK) === DISPOSED) return;

    // Use scheduler to dispose the reactive node
    // This handles dependency graph cleanup and marks the node as disposed
    disposeNode(scope, () => {
      // Run cleanup function if present
      if (scope.cleanup) {
        scope.cleanup();
        scope.cleanup = undefined;
      }
    });

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
  };

  /**
   * Fast path for element creation - skips idempotency checks
   * Use this when you know the element is brand new (e.g., in el.create())
   *
   * Performance optimizations vs withScope:
   * - No WeakMap.get() lookup (elements are always new)
   * - No object allocation for return value
   * - No try/catch overhead
   * - Returns null and unlinks scope if no disposables (avoids tree traversal overhead)
   */
  const createElementScope = <TElem extends object = object>(
    element: TElem,
    fn: () => void
  ): RenderScope<TElem> | null => {
    // Use activeScope as parent for automatic hierarchy
    const parentScope = anyCtx.activeScope;
    const scope = createScope<TElem>(element, parentScope as RenderScope<TElem> | null | undefined);
    const prevScope = anyCtx.activeScope;
    anyCtx.activeScope = scope;

    fn();

    anyCtx.activeScope = prevScope;

    // CRITICAL: Only keep scope if it has disposables/renderFn
    // Otherwise unlink from parent tree to avoid traversal overhead
    if (scope.firstDisposable !== undefined || scope.renderFn !== undefined) {
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
   * Run code within the scope attached to an element
   * If a scope already exists for the element, reuses it (idempotent).
   * Otherwise creates a new scope, using ctx.activeScope as parent for hierarchy.
   * Returns null in scope field if no disposables/renderFn (scope is unlinked and discarded).
   */
  const withScope = <TElem extends object = object, T = void>(
    element: TElem,
    fn: (scope: RenderScope<TElem>) => T
  ): { result: T; scope: RenderScope<TElem> | null } => {
    // Try to get existing scope first (idempotent)
    let scope = anyCtx.elementScopes.get(element) as RenderScope<TElem> | undefined;
    let isNewScope = false;
    let parentScope: RenderScope<object> | null = null;

    if (!scope) {
      parentScope = anyCtx.activeScope;
      scope = createScope(element, parentScope as RenderScope<TElem> | undefined);
      isNewScope = true;
    }

    const prevScope = anyCtx.activeScope;
    anyCtx.activeScope = scope;

    let result: T;
    try {
      result = fn(scope);
    } catch (e) {
      // Only delete if we registered it
      if (scope.firstDisposable !== undefined) {
        anyCtx.elementScopes.delete(element);
      }
      disposeScope(scope); // Clean up any disposables that were registered before error
      throw e;
    } finally {
      anyCtx.activeScope = prevScope;
    }

    // CRITICAL: Only keep scope if it has disposables/renderFn
    if (isNewScope && (scope.firstDisposable !== undefined || scope.renderFn !== undefined)) {
      anyCtx.elementScopes.set(element, scope);
      return { result, scope };
    }

    // No disposables - unlink from parent tree and return null
    if (isNewScope && parentScope && parentScope.firstChild === scope) {
      parentScope.firstChild = scope.nextSibling;
    }

    return { result, scope: isNewScope ? null : scope };
  }

  /**
   * Create a scope-aware effect that automatically tracks itself in activeScope
   */
  const scopedEffect = (fn: () => void | (() => void)): () => void => {
    // Create the underlying effect
    const dispose = baseEffect(fn);

    // Auto-track in current scope if one is active
    const scope = anyCtx.activeScope;

    // Track the dispose function in the current scope
    if (scope) scope.firstDisposable = { dispose, next: scope.firstDisposable };

    return dispose;
  }

  /**
   * Register a cleanup function to run when the current scope is disposed.
   * Must be called within a scope context (e.g., inside withScope or element setup).
   */
  const onCleanup = (cleanup: () => void): void => {
    const scope = anyCtx.activeScope;
    if (!scope) return;

    // Track cleanup directly in active scope
    scope.firstDisposable = { dispose: cleanup, next: scope.firstDisposable };
  }

  return {
    disposeScope,
    withScope,
    createElementScope,
    scopedEffect,
    onCleanup,
  };
}


