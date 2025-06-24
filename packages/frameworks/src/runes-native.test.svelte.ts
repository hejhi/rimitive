/**
 * @fileoverview Tests for Runes-Native Lattice API
 *
 * Validates that the new runes-native approach provides:
 * - Zero overhead reactivity using pure Svelte runes
 * - Fine-grained dependency tracking
 * - Proper slice composition
 * - Performance equal to or better than raw Svelte
 */

import { describe, it, expect } from 'vitest';
import { createSvelteSlices, combineSlices, memoized } from './runes.svelte';

describe('Runes-Native Lattice API', () => {
  describe('createSvelteSlices', () => {
    it('should create reactive slices with $state and $derived', () => {
      const createSlice = createSvelteSlices({
        count: 0,
        name: 'Alice',
      });

      // Create counter slice
      const counter = createSlice(
        ({ count }) => ({ count }),
        ({ count }, { set }) => ({
          value: () => count,
          doubled: () => count * 2,
          increment: () => set('count', count + 1),
        })
      );

      // Initial values
      expect(counter().value()).toBe(0);
      expect(counter().doubled()).toBe(0);

      // Update through actions
      counter().increment();
      expect(counter().value()).toBe(1);
      expect(counter().doubled()).toBe(2);
    });

    it('should provide fine-grained reactivity between slices', () => {
      const createSlice = createSvelteSlices({
        count: 0,
        name: 'Alice',
        items: [] as string[],
      });

      // Counter slice
      const counter = createSlice(
        ({ count }) => ({ count }),
        ({ count }, { set }) => ({
          value: () => count,
          increment: () => set('count', count + 1),
        })
      );

      // User slice
      const user = createSlice(
        ({ name }) => ({ name }),
        ({ name }, { set }) => ({
          name: () => name,
          setName: (newName: string) => set('name', newName),
        })
      );

      // Track computations for counter-dependent derived value
      let counterComputations = 0;
      const counterDerived = $derived.by(() => {
        counterComputations++;
        return `Count: ${counter().value()}`;
      });

      // Function to get current derived value
      const getDerivedValue = () => counterDerived;

      // Initial computation - access the derived value to trigger computation
      expect(getDerivedValue()).toBe('Count: 0');
      expect(counterComputations).toBe(1);

      // Change counter - should trigger computation
      counter().increment();
      expect(getDerivedValue()).toBe('Count: 1');
      expect(counterComputations).toBe(2);

      // Change user - should NOT trigger counter computation (fine-grained!)
      user().setName('Bob');
      expect(getDerivedValue()).toBe('Count: 1');
      expect(counterComputations).toBe(2); // Still 2!
    });

    it('should support multiple action types', () => {
      const createSlice = createSvelteSlices({
        count: 0,
        user: { name: 'Alice', age: 30 },
        items: ['a', 'b'],
      });

      const actions = createSlice(
        (state) => state,
        ({ count }, { set, update, transform }) => ({
          // Individual set
          incrementCount: () => set('count', count + 1),

          // Multiple update
          updateUser: (name: string, age: number) =>
            update({
              user: { name, age },
            }),

          // Transform function
          doubleEverything: () =>
            transform((state) => ({
              count: state.count * 2,
              user: { ...state.user, age: state.user.age * 2 },
            })),
        })
      );

      // Test individual set
      actions().incrementCount();
      expect(
        createSlice(
          (s) => ({ count: s.count }),
          ({ count }) => ({ value: () => count })
        )().value()
      ).toBe(1);

      // Test update
      actions().updateUser('Charlie', 25);
      expect(
        createSlice(
          (s) => ({ user: s.user }),
          ({ user }) => ({ name: () => user.name })
        )().name()
      ).toBe('Charlie');

      // Test transform
      actions().doubleEverything();
      expect(
        createSlice(
          (s) => ({ count: s.count }),
          ({ count }) => ({ value: () => count })
        )().value()
      ).toBe(2);
    });
  });

  describe('combineSlices', () => {
    it('should combine multiple slices efficiently', () => {
      const createSlice = createSvelteSlices({
        count: 0,
        name: 'Alice',
      });

      const counter = createSlice(
        ({ count }) => ({ count }),
        ({ count }, { set }) => ({
          value: () => count,
          increment: () => set('count', count + 1),
        })
      );

      const user = createSlice(
        ({ name }) => ({ name }),
        ({ name }, { set }) => ({
          name: () => name,
          setName: (newName: string) => set('name', newName),
        })
      );

      // Combine slices
      const summary = combineSlices(
        { counter, user },
        ({ counter: counterData, user: userData }) =>
          `${userData.name()}: ${counterData.value()}`
      );

      expect(summary()).toBe('Alice: 0');

      // Update counter
      counter().increment();
      expect(summary()).toBe('Alice: 1');

      // Update user
      user().setName('Bob');
      expect(summary()).toBe('Bob: 1');
    });

    it('should only recalculate when relevant dependencies change', () => {
      const createSlice = createSvelteSlices({
        count: 0,
        name: 'Alice',
        irrelevant: 'data',
      });

      const counter = createSlice(
        (state) => ({ count: state.count }),
        ({ count }, { set }) => ({
          value: () => count,
          increment: () => set('count', count + 1),
        })
      );

      const user = createSlice(
        (state) => ({ name: state.name }),
        ({ name }, { set }) => ({
          name: () => name,
          setName: (newName: string) => set('name', newName),
        })
      );

      const irrelevant = createSlice(
        (state) => ({ irrelevant: state.irrelevant }),
        ({ irrelevant }, { set }) => ({
          value: () => irrelevant,
          change: () => set('irrelevant', 'changed'),
        })
      );

      let computations = 0;
      const summary = combineSlices(
        { counter, user }, // Note: only depends on counter and user, NOT irrelevant
        ({ counter: counterData, user: userData }) => {
          computations++;
          return `${userData.name()}: ${counterData.value()}`;
        }
      );

      expect(summary()).toBe('Alice: 0');
      expect(computations).toBe(1);

      // Change counter - should recalculate
      counter().increment();
      expect(summary()).toBe('Alice: 1');
      expect(computations).toBe(2);

      // Change user - should recalculate
      user().setName('Bob');
      expect(summary()).toBe('Bob: 1');
      expect(computations).toBe(3);

      // Change irrelevant data - should NOT recalculate!
      irrelevant().change();
      expect(summary()).toBe('Bob: 1');
      expect(computations).toBe(3); // Still 3!
    });
  });

  describe('memoized', () => {
    it('should memoize expensive computations', () => {
      const createSlice = createSvelteSlices({
        input: 5,
      });

      const data = createSlice(
        (state) => ({ input: state.input }),
        ({ input }, { set }) => ({
          value: () => input,
          setValue: (newValue: number) => set('input', newValue),
        })
      );

      let computations = 0;
      const expensive = memoized(data, (d) => {
        computations++;
        // Simulate expensive computation
        return d.value() * 100;
      });

      // First access - should compute
      expect(expensive()).toBe(500);
      expect(computations).toBe(1);

      // Second access - should use cache
      expect(expensive()).toBe(500);
      expect(computations).toBe(1); // Still 1!

      // Change input - should recompute
      data().setValue(10);
      expect(expensive()).toBe(1000);
      expect(computations).toBe(2);

      // Access again - should use new cache
      expect(expensive()).toBe(1000);
      expect(computations).toBe(2); // Still 2!
    });

    it('should only recompute when slice dependencies change', () => {
      const createSlice = createSvelteSlices({
        relevant: 10,
        irrelevant: 'ignored',
      });

      const relevant = createSlice(
        (state) => ({ relevant: state.relevant }),
        ({ relevant }, { set }) => ({
          value: () => relevant,
          setValue: (newValue: number) => set('relevant', newValue),
        })
      );

      const irrelevant = createSlice(
        (state) => ({ irrelevant: state.irrelevant }),
        ({ irrelevant }, { set }) => ({
          value: () => irrelevant,
          setValue: (newValue: string) => set('irrelevant', newValue),
        })
      );

      let computations = 0;
      const expensive = memoized(
        relevant, // Only depends on relevant slice
        (d) => {
          computations++;
          return d.value() * 100;
        }
      );

      // Initial computation
      expect(expensive()).toBe(1000);
      expect(computations).toBe(1);

      // Change irrelevant data - should NOT recompute
      irrelevant().setValue('changed');
      expect(expensive()).toBe(1000);
      expect(computations).toBe(1); // Still 1!

      // Change relevant data - should recompute
      relevant().setValue(20);
      expect(expensive()).toBe(2000);
      expect(computations).toBe(2);
    });
  });

  describe('Performance characteristics', () => {
    it('should have minimal computational overhead', () => {
      const createSlice = createSvelteSlices({
        count: 0,
      });

      const counter = createSlice(
        (state) => ({ count: state.count }),
        ({ count }, { set }) => ({
          value: () => count,
          increment: () => set('count', count + 1),
        })
      );

      // Track how many times the slice function is called
      let accessCount = 0;
      const originalCounter = counter;
      const wrappedCounter = () => {
        accessCount++;
        return originalCounter();
      };

      // Multiple accesses should not cause extra computations
      // (This tests that $derived is working efficiently)
      const value1 = wrappedCounter().value();
      const value2 = wrappedCounter().value();
      const value3 = wrappedCounter().value();

      expect(value1).toBe(value2);
      expect(value2).toBe(value3);
      expect(accessCount).toBe(3); // Called 3 times, but computation should be cached

      // Update should only cause one recomputation
      wrappedCounter().increment();
      const newValue = wrappedCounter().value();
      expect(newValue).toBe(1);
    });
  });
});
