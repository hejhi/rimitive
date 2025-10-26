import type { Disposable, RenderScope, DisposableNode } from '../types';
import type { GraphEdges } from '@lattice/signals/helpers/graph-edges';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import { CONSTANTS } from '@lattice/signals/constants';

const { CLEAN, CONSUMER, SCHEDULED, DISPOSED, STATE_MASK } = CONSTANTS;

// Status combination for render scopes (consumer + scheduled + clean)
const RENDER_SCOPE_CLEAN = CONSUMER | SCHEDULED | CLEAN;

/**
 * Low-level scope primitives used by higher-level helpers.
 *
 * For most use cases, prefer the context-based helpers:
 * - `withScope` (from with-scope.ts) instead of manual createScope + ctx management
 * - `scopedEffect` (from scoped-effect.ts) instead of manual effect + trackInScope
 * - `withElementScope` (from with-scope.ts) instead of manual runInScope
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
   * Track a disposable in a specific scope (not the active scope).
   * Used for lifecycle callbacks that need explicit scope targeting.
   */
  trackInSpecificScope: <TElement = object>(scope: RenderScope<TElement>, disposable: Disposable) => void;

  /**
   * Dispose a scope and all its children/disposables.
   * Used by reconciliation logic when elements are removed.
   */
  disposeScope: <TElement = object>(scope: RenderScope<TElement>) => void;
};

export function createScopes({
  track,
  dispose: disposeNode,
}: {
  track: GraphEdges['track'];
  dispose: Scheduler['dispose'];
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
   * Track a disposable in a specific scope (not the active scope).
   *
   * This is used when you need to explicitly target a scope, such as tracking
   * lifecycle callbacks. For automatic tracking based on activeScope, use
   * scopedEffect from scoped-effect.ts instead.
   *
   * Uses linked list prepend for O(1) insertion.
   */
  const trackInSpecificScope = <TElement = object>(
    scope: RenderScope<TElement>,
    disposable: Disposable
  ): void => {
    // Only track if scope is not disposed
    if ((scope.status & STATE_MASK) !== DISPOSED) {
      // Prepend to linked list (O(1))
      const node: DisposableNode = {
        disposable,
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    }
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

  return {
    createScope,
    trackInSpecificScope,
    disposeScope,
  };
}


