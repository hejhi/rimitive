import { describe, it, expect } from 'vitest';
import { ApiMethods } from '../types';

// Import the function we're going to test (which doesn't exist yet)
// This will make the test fail until we implement it
import { createAPI } from '../api';

describe('Basic API Store', () => {
  // Basic test that follows the spec pattern for createAPI
  it('should create most minimal API store possible', () => {
    // Define a simple API structure
    interface SimpleApi extends ApiMethods {
      count: number;
      increment: () => void;
      decrement: () => void;
    }

    // Create an API store following the pattern from the spec
    const { api, hooks } = createAPI<{}, SimpleApi>({}, (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // Verify API structure
    expect(api).toBeDefined();
    expect(typeof api.count).toBe('number');
    expect(typeof api.increment).toBe('function');
    expect(typeof api.decrement).toBe('function');

    // Verify hooks system is present
    expect(hooks).toBeDefined();
    expect(typeof hooks.before).toBe('function');
    expect(typeof hooks.after).toBe('function');

    // Verify API use property (for React hooks) is present
    expect(api.use).toBeDefined();
    expect(typeof api.use.count).toBe('function');
    expect(typeof api.use.increment).toBe('function');
    expect(typeof api.use.decrement).toBe('function');

    // Test functionality
    expect(api.count).toBe(0);
    api.increment();
    expect(api.count).toBe(1);
    api.decrement();
    expect(api.count).toBe(0);
  });
});
