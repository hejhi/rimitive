/**
 * Shared test helpers for creating scopes with mock dependencies
 *
 * These helpers provide a clean public API for tests without exposing internals.
 */

import { vi } from 'vitest';
import { createScopes } from './helpers/scope';

// Mock element for testing
export type MockTestElement = { __mock: boolean };
export const createMockElement = (): MockTestElement => ({ __mock: true });

/**
 * Create scopes with mock dependencies for testing
 *
 * This provides the same public API as the production createScopes,
 * but with a mocked baseEffect for testing purposes.
 */
export const createTestScopes = () => {
  // Mock effect that runs synchronously for testing
  const baseEffect = vi.fn((fn: () => void | (() => void)) => {
    const cleanup = fn();
    return cleanup || (() => {});
  });

  const scopes = createScopes({ baseEffect });

  return {
    ...scopes,
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
    batch<T>(fn: () => T): T {
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
      }
    },
  };
};
