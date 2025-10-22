import type { Disposable } from '../types';
import type { ViewContext } from '../context';

/**
 * Scope is a minimal data structure inspired by signals node design.
 * Uses intrusive linked lists for memory efficiency and O(1) operations.
 *
 * Tree structure:
 * - parent: Parent scope in the tree
 * - firstChild: First child scope
 * - nextSibling: Next sibling scope
 *
 * Disposables:
 * - firstDisposable: Head of disposables linked list
 *
 * Status bits:
 * - ACTIVE (0): Scope is active
 * - DISPOSED (1): Scope has been disposed
 */

const ACTIVE = 0;
const DISPOSED = 1;

export interface Scope {
  parent: Scope | undefined;
  firstChild: Scope | undefined;
  nextSibling: Scope | undefined;
  firstDisposable: DisposableNode | undefined;
  status: number;
}

/**
 * Wrapper for disposables to form linked list
 */
interface DisposableNode {
  disposable: Disposable;
  next: DisposableNode | undefined;
}

export type CreateScopes = {
  createScope: (parent?: Scope) => Scope;
  runInScope: <T>(scope: Scope, fn: () => T) => T;
  trackInScope: (disposable: Disposable) => void;
  trackInSpecificScope: (scope: Scope, disposable: Disposable) => void;
  disposeScope: (scope: Scope) => void;
};

export function createScopes({ ctx }: { ctx: ViewContext }): CreateScopes {
  /**
   * Create a new disposal scope (minimal allocation)
   * Optionally attach to parent scope in the tree
   */
  const createScope = (parent?: Scope): Scope => {
    const scope: Scope = {
      parent,
      firstChild: undefined,
      nextSibling: undefined,
      firstDisposable: undefined,
      status: ACTIVE,
    };

    // Attach to parent's child list
    if (parent) {
      scope.nextSibling = parent.firstChild;
      parent.firstChild = scope;
    }

    return scope;
  };

  /**
   * Run function within scope context
   * Standalone function like signals/graph-edges.ts track()
   */
  const runInScope = <T>(scope: Scope, fn: () => T): T => {
    const prevScope = ctx.currentScope;
    ctx.currentScope = scope;
    try {
      return fn();
    } finally {
      ctx.currentScope = prevScope;
    }
  };

  /**
   * Track a disposable in the current scope (if any)
   * Like signals trackDependency - checks ctx first
   * Uses linked list prepend for O(1) insertion
   */
  const trackInScope = (disposable: Disposable): void => {
    const scope = ctx.currentScope;
    if (scope) {
      trackInSpecificScope(scope, disposable);
    }
  };

  /**
   * Track a disposable in a specific scope (not current)
   * Direct scope manipulation for when currentScope isn't set
   * Uses linked list prepend for O(1) insertion
   */
  const trackInSpecificScope = (scope: Scope, disposable: Disposable): void => {
    if (scope.status === ACTIVE) {
      // Prepend to linked list (O(1))
      const node: DisposableNode = {
        disposable,
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    }
  };

  /**
   * Dispose all tracked subscriptions and child scopes
   * Like signals/scheduler.ts dispose - idempotent cleanup
   * Walks linked lists to dispose disposables and children
   */
  const disposeScope = (scope: Scope): void => {
    // Already disposed
    if (scope.status === DISPOSED) return;

    // Mark as disposed
    scope.status = DISPOSED;

    // Dispose all child scopes recursively
    let child = scope.firstChild;
    while (child) {
      const next = child.nextSibling;
      disposeScope(child);
      child = next;
    }

    // Dispose all tracked disposables
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
    runInScope,
    trackInScope,
    trackInSpecificScope,
    disposeScope,
  };
}


