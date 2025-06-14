import { describe, it, expect } from 'vitest';
import { createAdapterTestSuite, type TestAdapterFactory } from './adapter-contract-tests';

describe('createAdapterTestSuite', () => {
  it('should validate a minimal mock adapter', () => {
    // Create a minimal mock adapter factory
    const createMockAdapter: TestAdapterFactory = <State>(
      initialState?: State
    ) => {
      let state = initialState || ({} as State);
      const listeners = new Set<() => void>();

      return {
        getState: () => state,
        setState: (updates: Partial<State>) => {
          state = { ...state, ...updates };
          listeners.forEach((listener) => listener());
        },
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    };

    // The test suite should pass for this valid implementation
    // We're not running the full suite here, just verifying it compiles
    expect(() =>
      createAdapterTestSuite('Mock', createMockAdapter)
    ).not.toThrow();
  });
});