import type { Disposable, RenderScope, DisposableNode, ReactiveElement } from '../types';
import type { LatticeContext } from '../context';
import type { GraphEdges } from '@lattice/signals/helpers/graph-edges';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import { CONSTANTS } from '@lattice/signals/constants';

const { CLEAN, CONSUMER, SCHEDULED, DISPOSED, STATE_MASK } = CONSTANTS;

// Status combination for render scopes (consumer + scheduled + clean)
const RENDER_SCOPE_CLEAN = CONSUMER | SCHEDULED | CLEAN;

export type CreateScopes = {
  createScope: <TElement = object>(
    element: TElement,
    parent?: RenderScope<TElement>,
    renderFn?: () => void | (() => void)
  ) => RenderScope<TElement>;
  createRenderEffect: <TElement = object>(
    element: TElement,
    renderFn: () => void | (() => void),
    parent?: RenderScope<TElement>
  ) => RenderScope<TElement>;
  runInScope: <T, TElement = object>(scope: RenderScope<TElement>, fn: () => T) => T;
  trackInScope: (disposable: Disposable) => void;
  trackInSpecificScope: <TElement = object>(scope: RenderScope<TElement>, disposable: Disposable) => void;
  disposeScope: <TElement = object>(scope: RenderScope<TElement>) => void;
};

export function createScopes({
  ctx,
  track,
  dispose: disposeNode,
}: {
  ctx: LatticeContext;
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
   * Create a RenderScope with a render function for reactive updates
   * This is a convenience wrapper around createScope that always includes a renderFn
   *
   * Use this when you want a component that automatically re-renders when signals change.
   * The renderFn will be tracked and any signals it reads will trigger re-renders.
   */
  const createRenderEffect = <TElement = object>(
    element: TElement,
    renderFn: () => void | (() => void),
    parent?: RenderScope<TElement>
  ): RenderScope<TElement> => {
    return createScope(element, parent, renderFn);
  };

  /**
   * Run function within scope context
   * Sets the active scope for both reactive tracking and lifecycle management
   */
  const runInScope = <T, TElement = object>(
    scope: RenderScope<TElement>,
    fn: () => T
  ): T => {
    const prevScope = ctx.activeScope;
    // Cast is safe: element type is a phantom type that doesn't affect scope behavior.
    // The scope participates in the reactive graph regardless of element type.
    ctx.activeScope = scope as RenderScope<ReactiveElement>;
    try {
      return fn();
    } finally {
      ctx.activeScope = prevScope;
    }
  };

  /**
   * Track a disposable in the current scope (if any)
   * Checks ctx.activeScope and delegates to trackInSpecificScope
   */
  const trackInScope = (disposable: Disposable): void => {
    const scope = ctx.activeScope;
    if (scope) {
      trackInSpecificScope(scope, disposable);
    }
  };

  /**
   * Track a disposable in a specific scope
   * Direct scope manipulation for when activeScope isn't set
   * Uses linked list prepend for O(1) insertion
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
    createRenderEffect,
    runInScope,
    trackInScope,
    trackInSpecificScope,
    disposeScope,
  };
}


