/**
 * Shared test helpers for creating scopes with mock dependencies
 */

import { createScopes } from './helpers/scope';
import { createLatticeContext } from './context';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import type { RenderScope } from './types';
import { CONSTANTS } from '@lattice/signals/constants';

const { DISPOSED, STATE_MASK, CONSUMER, SCHEDULED } = CONSTANTS;

// Mock element for testing
export const createMockElement = () => ({ __mock: true });

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
export const createTestScopes = (providedCtx?: ReturnType<typeof createLatticeContext>) => {
  const ctx = providedCtx || createLatticeContext();
  const track = <T>(_node: unknown, fn: () => T): T => fn();

  // Mock dispose that mimics real scheduler behavior
  const dispose = <T>(_node: unknown, cleanup: (node: T) => void): void => {
    const scope = _node as RenderScope;

    // Check if already disposed (idempotent)
    if ((scope.status & STATE_MASK) === DISPOSED) return;

    // Set DISPOSED status (mimics scheduler.dispose line 154)
    scope.status = CONSUMER | SCHEDULED | DISPOSED;

    // Call cleanup callback
    cleanup(_node as T);

    // Clear dependencies (mimics scheduler.dispose lines 157-165)
    scope.dependencies = undefined;
    scope.dependencyTail = undefined;
  };

  const scopes = createScopes({ track, dispose });

  // Add helper functions for tests (wrapping low-level primitives)
  return {
    ...scopes,
    ctx,
    // Run function within scope context
    runInScope: <T>(scope: RenderScope, fn: () => T): T => {
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
          disposable,
          next: scope.firstDisposable,
        };
        scope.firstDisposable = node;
      }
    },
    // Track in specific scope (not active scope)
    trackInSpecificScope: <TElement = object>(
      scope: RenderScope<TElement>,
      disposable: { dispose: () => void }
    ) => {
      const node = {
        disposable,
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    },
    // Create render effect (scope with renderFn)
    createRenderEffect: <TElement = object>(
      element: TElement,
      renderFn: () => void | (() => void),
      parent?: RenderScope<TElement>
    ): RenderScope<TElement> => {
      return scopes.createScope(element, parent, renderFn);
    },
  };
};
