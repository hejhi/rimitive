/**
 * Shared test helpers for creating scopes with mock dependencies
 */

import { vi } from 'vitest';
import { createScopes } from './helpers/scope';
import { createLatticeContext, type LatticeContext } from './context';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import type { RenderScope } from './types';
import { CONSTANTS } from '@lattice/signals/constants';

const { DISPOSED, STATE_MASK, CONSUMER, SCHEDULED } = CONSTANTS;

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
export const createTestScopes = <TElement extends object = MockTestElement>(providedCtx?: LatticeContext<TElement>) => {
  const ctx = providedCtx || createLatticeContext<TElement>();
  const track = <T>(_node: unknown, fn: () => T): T => fn();

  // Mock dispose that mimics real scheduler behavior
  const dispose = <T>(_node: unknown, cleanup: (node: T) => void): void => {
    const scope = _node as RenderScope<HTMLElement>;

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

  const baseEffect = vi.fn((fn: () => void | (() => void)) => {
    fn();
    return () => {};
  });

  const scopes = createScopes<TElement>({ ctx, track, dispose, baseEffect });

  // Add helper functions for tests (wrapping low-level primitives)
  return {
    ...scopes,
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
