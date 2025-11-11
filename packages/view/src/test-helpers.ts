/**
 * Shared test helpers for creating scopes with mock dependencies
 */

import { vi } from 'vitest';
import { createScopes } from './helpers/scope';
import { createBaseContext, type ViewContext } from './context';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import type { RenderScope } from './types';

// Mock element for testing
export type MockTestElement = { __mock: boolean };
export const createMockElement = (): MockTestElement => ({ __mock: true });

/**
 * Create a mock scheduler for testing with batching support
 * Tracks batch depth to verify correct batching behavior
 */
export const createTestScheduler = (): Pick<Scheduler, 'startBatch' | 'endBatch' | 'flush'> & { batchDepth: number } => {
  let batchDepth = 0;

  return {
    get batchDepth() {
      return batchDepth;
    },
    startBatch: () => {
      batchDepth++;
      return batchDepth;
    },
    endBatch: () => {
      if (batchDepth > 0) {
        batchDepth--;
      }
      return batchDepth;
    },
    flush: () => {
      // No-op in tests - effects are executed synchronously
    },
  };
};

// Helper to create scopes with mock dependencies
export const createTestScopes = <TElement extends object = MockTestElement>(
  providedCtx?: ViewContext<TElement>
) => {
  const ctx = providedCtx || createBaseContext<TElement>();

  // Mock detachAll - no-op for tests since we don't track real dependencies
  const detachAll = vi.fn(() => {
    // No-op in tests
  });

  const baseEffect = vi.fn((fn: () => void | (() => void)) => {
    fn();
    return () => {};
  });

  const scopes = createScopes<TElement>({ ctx, detachAll, baseEffect });

  // Test-only withScope implementation for backward compatibility with tests
  const withScope = <TElem extends TElement = TElement, T = void>(
    element: TElem,
    fn: (scope: RenderScope<TElem>) => T
  ): { result: T; scope: RenderScope<TElem> | null } => {
    // Try to get existing scope first (idempotent)
    let scope = ctx.elementScopes.get(element) as
      | RenderScope<TElem>
      | undefined;
    let isNewScope = false;
    let parentScope: RenderScope<TElement> | null = null;

    if (!scope) {
      parentScope = ctx.activeScope;

      // Create scope inline
      const RENDER_SCOPE_CLEAN = 0b10000001; // CONSUMER | CLEAN (0b10000000 | 0b00000001)
      scope = {
        __type: 'render-scope',
        status: RENDER_SCOPE_CLEAN,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
        firstChild: undefined,
        nextSibling: undefined,
        firstDisposable: undefined,
        element,
      };

      // Attach to parent's child list
      if (parentScope) {
        scope.nextSibling = parentScope.firstChild as
          | RenderScope<TElem>
          | undefined;
        parentScope.firstChild = scope as RenderScope<TElement>;
      }

      isNewScope = true;
    }

    const prevScope = ctx.activeScope;
    ctx.activeScope = scope;

    let result: T;
    try {
      result = fn(scope);
    } catch (e) {
      // Only delete if we registered it
      if (scope.firstDisposable !== undefined) {
        ctx.elementScopes.delete(element);
      }
      scopes.disposeScope(scope); // Clean up any disposables that were registered before error
      throw e;
    } finally {
      ctx.activeScope = prevScope;
    }

    // CRITICAL: Only keep scope if it has disposables
    if (isNewScope && scope.firstDisposable !== undefined) {
      ctx.elementScopes.set(element, scope);
      return { result, scope };
    }

    // No disposables - unlink from parent tree and return null
    if (isNewScope && parentScope && parentScope.firstChild === scope) {
      parentScope.firstChild = scope.nextSibling;
    }

    return { result, scope: isNewScope ? null : scope };
  };

  // Add helper functions for tests (wrapping low-level primitives)
  return {
    ...scopes,
    withScope,
    ctx,
    // Run function within scope context
    runInScope: <T>(scope: RenderScope<TElement>, fn: () => T): T => {
      const prevScope = ctx.activeScope;
      ctx.activeScope = scope;
      try {
        return fn();
      } finally {
        ctx.activeScope = prevScope;
      }
    },
    // Track in current active scope
    trackInScope: (disposable: { dispose: () => void }) => {
      const scope = ctx.activeScope;
      if (scope) {
        const node = {
          dispose: disposable.dispose,
          next: scope.firstDisposable,
        };
        scope.firstDisposable = node;
      }
    },
    // Track in specific scope (not active scope)
    trackInSpecificScope: (
      scope: RenderScope<TElement>,
      disposable: { dispose: () => void }
    ) => {
      const node = {
        dispose: disposable.dispose,
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    },
  };
};
