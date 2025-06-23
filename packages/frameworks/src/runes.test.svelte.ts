import { describe, it, expect } from 'vitest';
import { createStore } from '@lattice/core';

describe('Runes-powered Lattice Store (Experimental)', () => {
  it('should work with Lattice slices and runes reactivity', () => {
    // Create a simple state object with runes
    // NOTE: $state must be declared separately - the Svelte compiler
    // requires this pattern, not createStore($state(...))
    const state = $state({ count: 0, name: 'Alice' });

    // Create Lattice store from the runes state
    const createSlice = createStore(state);

    // Create a slice that tracks the count
    const counterSlice = createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        value: () => count(),
        increment: () =>
          set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() + 1 })
          ),
        doubled: () => count() * 2,
      })
    );

    // Test that the slice works
    const counter = counterSlice();
    expect(counter.value()).toBe(0);
    expect(counter.doubled()).toBe(0);

    // Update through the slice
    counter.increment();

    // Verify the slice reflects the change
    expect(counter.value()).toBe(1);
    expect(counter.doubled()).toBe(2);

    // Verify the underlying runes state was updated
    expect(state.count).toBe(1);
  });
});
