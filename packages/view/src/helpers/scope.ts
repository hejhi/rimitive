/**
 * PATTERN: Element-Scoped Disposal
 *
 * Each element gets its own scope that tracks all reactive subscriptions
 * (effects, computeds) created within it. When the element is removed from
 * the DOM, the scope disposes all subscriptions to prevent memory leaks.
 *
 * CONCURRENCY-SAFE:
 * Uses ViewContext to track current scope (not module-level state).
 * Multiple component trees can coexist without interference.
 *
 * MEMORY MANAGEMENT:
 * - Set<Disposable> is acceptable here (not a hot path like signal graph)
 * - Scope disposal happens infrequently (only on element removal)
 * - Effects integrate with scheduler automatically for batching
 */

import type { Disposable } from '../types';
import type { ViewContext } from '../context';

/**
 * Scope is a minimal data structure (like signals node)
 * Methods are standalone functions to avoid per-instance allocation
 */
export interface Scope {
  disposables: Set<Disposable>;
}

/**
 * Create a new disposal scope (minimal allocation)
 */
export function createScope(): Scope {
  return {
    disposables: new Set<Disposable>(),
  };
}

/**
 * Run function within scope context
 * PATTERN: Standalone function like signals/graph-edges.ts track()
 */
export function runInScope<T>(ctx: ViewContext, scope: Scope, fn: () => T): T {
  const prevScope = ctx.currentScope;
  ctx.currentScope = scope;
  try {
    return fn();
  } finally {
    ctx.currentScope = prevScope;
  }
}

/**
 * Track a disposable in the current scope (if any)
 * PATTERN: Like signals trackDependency - checks ctx first
 */
export function trackInScope(ctx: ViewContext, disposable: Disposable): void {
  const scope = ctx.currentScope;
  if (scope) {
    scope.disposables.add(disposable);
  }
}

/**
 * Dispose all tracked subscriptions
 * PATTERN: Like signals/scheduler.ts dispose - idempotent cleanup
 */
export function disposeScope(scope: Scope): void {
  for (const d of scope.disposables) {
    if (d && typeof d.dispose === 'function') {
      d.dispose();
    }
  }
  scope.disposables.clear();
}
