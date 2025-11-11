/**
 * Shared test helpers for creating scopes with mock dependencies
 *
 * These helpers provide a clean public API for tests without exposing internals.
 */

import { vi } from 'vitest';
import { createScopes } from './helpers/scope';
import { createBaseContext, type ViewContext } from './context';

// Mock element for testing
export type MockTestElement = { __mock: boolean };
export const createMockElement = (): MockTestElement => ({ __mock: true });

/**
 * Create scopes with mock dependencies for testing
 *
 * This provides the same public API as the production createScopes,
 * but with a mocked baseEffect for testing purposes.
 */
export const createTestScopes = <TElement extends object = MockTestElement>(
  providedCtx?: ViewContext<TElement>
) => {
  const ctx = providedCtx || createBaseContext<TElement>();

  // Mock effect that runs synchronously for testing
  const baseEffect = vi.fn((fn: () => void | (() => void)) => {
    const cleanup = fn();
    return cleanup || (() => {});
  });

  const scopes = createScopes<TElement>({ ctx, baseEffect });

  return {
    ...scopes,
    ctx,
    baseEffect,
  };
};

/**
 * Create a test scheduler with batching support for testing event handlers
 */
export const createTestScheduler = () => {
  let batchDepth = 0;

  return {
    get batchDepth() {
      return batchDepth;
    },
    startBatch(): number {
      return ++batchDepth;
    },
    endBatch(): number {
      return --batchDepth;
    },
  };
};
