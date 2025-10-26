import type { RenderScope } from '../types';
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
    disposeScope,
  };
}


