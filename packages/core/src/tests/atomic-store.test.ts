import { describe, it, expect } from 'vitest';
import { create } from 'zustand';

// This test case tests the most fundamental Zustand pattern we'll build on
// It should create a minimal store with proper typings
describe('Atomic Store Fundamentals', () => {
  // Define a simple store type to test with
  interface CounterState {
    count: number;
    increment: () => void;
    decrement: () => void;
  }

  it('should create minimal Zustand stores with proper typings', () => {
    // Create a minimal Zustand store
    const useCounterStore = create<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // This test is just verifying types work as expected
    // If TypeScript compiles, then types are working

    // Create a store instance
    const store = useCounterStore;

    // Access the current state
    const state = store.getState();

    // Verify we can access properties and methods with correct types
    expect(typeof state.count).toBe('number');
    expect(typeof state.increment).toBe('function');
    expect(typeof state.decrement).toBe('function');

    // Verify initial state
    expect(state.count).toBe(0);

    // Verify state updates work
    state.increment();
    expect(store.getState().count).toBe(1);

    state.decrement();
    expect(store.getState().count).toBe(0);
  });
});
