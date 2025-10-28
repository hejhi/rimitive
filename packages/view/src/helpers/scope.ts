import type { RenderScope } from '../types';
import type { LatticeContext } from '../context';
import type { GraphEdges } from '@lattice/signals/helpers/graph-edges';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import { CONSTANTS } from '@lattice/signals/constants';

const { CLEAN, CONSUMER, SCHEDULED, DISPOSED, STATE_MASK } = CONSTANTS;

// Status combination for render scopes (consumer + scheduled + clean)
const RENDER_SCOPE_CLEAN = CONSUMER | SCHEDULED | CLEAN;

/**
 * Low-level scope primitives used by higher-level helpers.
 */
export type CreateScopes = {
  /**
   * Create a new RenderScope.
   * Used internally by withScope - prefer that for declarative scope management.
   */
  createScope: <TElement = object>(
    element: TElement,
    parent?: RenderScope<TElement>,
    renderFn?: () => void | (() => void)
  ) => RenderScope<TElement>;

  /**
   * Dispose a scope and all its children/disposables.
   * Used by reconciliation logic when elements are removed.
   */
  disposeScope: <TElement = object>(scope: RenderScope<TElement>) => void;

  /**
   * Run code within a new scope attached to an element.
   * Handles full lifecycle: creation, registration, activation, and cleanup.
   * Automatically uses ctx.activeScope as parent for hierarchy.
   */
  withScope: <TElement extends object = object, T = void>(
    element: TElement,
    fn: (scope: RenderScope<TElement>) => T
  ) => { result: T; scope: RenderScope<TElement> };

  /**
   * Run code within an existing element's scope context.
   * Useful for attaching to parent scope without creating a new one.
   */
  withElementScope: <T>(
    element: object,
    fn: () => T
  ) => T;

  /**
   * Create a scope-aware effect that auto-tracks itself in activeScope.
   */
  scopedEffect: (fn: () => void | (() => void)) => () => void;
};

export function createScopes({
  ctx,
  track,
  dispose: disposeNode,
  baseEffect,
}: {
  ctx: LatticeContext;
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
  baseEffect: (fn: () => void | (() => void)) => () => void;
}): CreateScopes {
  /**
   * Create a new RenderScope instance
   * Combines reactive graph node (ScheduledNode) with tree structure (Scope)
   */
  const createScope = <TElement = object>(
    element: TElement,
    parent?: RenderScope<TElement>,
    renderFn?: () => void | (() => void)
  ): RenderScope<TElement> => {
    const scope: RenderScope<TElement> = {
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
        if (scope.renderFn) {
          // Clear previous cleanup
          if (scope.cleanup) {
            scope.cleanup();
            scope.cleanup = undefined;
          }
          // Re-run render with dependency tracking
          // track() establishes edges from signals to this scope
          const result = track(scope, scope.renderFn);
          // Store cleanup function if returned
          if (typeof result === 'function') {
            scope.cleanup = result;
          }
        }
      },

      // Tree structure (from Scope)
      parent,
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
    if (renderFn) {
      scope.flush();
    }

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
      const disposable = node.disposable;
      if (disposable && typeof disposable.dispose === 'function') {
        disposable.dispose();
      }
      node = node.next;
    }

    // Clear references
    scope.firstChild = undefined;
    scope.firstDisposable = undefined;
  };

  /**
   * Run code within a new scope attached to an element
   * Returns the created scope so callers can access it if needed.
   * Automatically uses ctx.activeScope as parent for hierarchy.
   */
  function withScope<TElement extends object = object, T = void>(
    element: TElement,
    fn: (scope: RenderScope<TElement>) => T
  ): { result: T; scope: RenderScope<TElement> } {
    // Use activeScope as parent for automatic hierarchy
    const parentScope = (ctx.activeScope || undefined) as RenderScope<TElement> | undefined;

    // Create scope
    const scope = createScope(element, parentScope);

    // Register so children/effects can find it
    ctx.elementScopes.set(element, scope);

    // Set as active scope and run code
    const prevScope = ctx.activeScope;
    ctx.activeScope = scope;

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
  }

  /**
   * Run code within an existing element's scope context
   * Useful for fragments/map that want to attach to parent scope without creating their own.
   */
  function withElementScope<T>(
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

  /**
   * Create a scope-aware effect that automatically tracks itself in activeScope
   */
  function scopedEffect(fn: () => void | (() => void)): () => void {
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
  }

  return {
    createScope,
    disposeScope,
    withScope,
    withElementScope,
    scopedEffect,
  };
}


