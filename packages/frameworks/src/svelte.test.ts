import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createStore } from '@lattice/core';
import {
  asStore,
  sliceDerived,
  combineSlices,
  asyncDerived,
  memoized,
} from './svelte';

describe('Svelte utilities - New slice-based API', () => {
  // Create test slices
  const createTestSlices = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

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

    const userSlice = createSlice(
      (selectors) => ({ name: selectors.name }),
      ({ name }, set) => ({
        name: () => name(),
        setName: (newName: string) =>
          set(
            (selectors) => ({ name: selectors.name }),
            () => ({ name: newName })
          ),
      })
    );

    const itemsSlice = createSlice(
      (selectors) => ({ items: selectors.items }),
      ({ items }, set) => ({
        all: () => items(),
        add: (item: string) =>
          set(
            (selectors) => ({ items: selectors.items }),
            ({ items }) => ({ items: [...items(), item] })
          ),
      })
    );

    return { counterSlice, userSlice, itemsSlice };
  };

  describe('asStore', () => {
    it('should convert slice to Svelte store', () => {
      const { counterSlice } = createTestSlices();
      const counterStore = asStore(counterSlice);

      // Initial value
      expect(get(counterStore).value()).toBe(0);
      expect(get(counterStore).doubled()).toBe(0);

      // Update and check reactivity
      get(counterStore).increment();
      expect(get(counterStore).value()).toBe(1);
      expect(get(counterStore).doubled()).toBe(2);
    });

    it('should be reactive to slice changes', () => {
      const { userSlice } = createTestSlices();
      const userStore = asStore(userSlice);
      const values: string[] = [];

      // Subscribe to store changes
      const unsubscribe = userStore.subscribe((user) => {
        values.push(user.name());
      });

      // Change the name
      get(userStore).setName('Alice');

      expect(values).toEqual(['test', 'Alice']);

      unsubscribe();
    });
  });

  describe('sliceDerived', () => {
    it('should create derived store from slice', () => {
      const { counterSlice } = createTestSlices();
      const doubled = sliceDerived(counterSlice, (counter) =>
        counter.doubled()
      );

      // Subscribe to ensure the store is active
      const values: number[] = [];
      const unsubscribe = doubled.subscribe((value) => values.push(value));

      expect(get(doubled)).toBe(0);

      // Update counter and check that the derived store updates
      counterSlice().increment();
      expect(get(doubled)).toBe(2);

      counterSlice().increment();
      expect(get(doubled)).toBe(4);

      expect(values).toEqual([0, 2, 4]);

      unsubscribe();
    });

    it('should only update when slice dependencies change', () => {
      const { counterSlice, userSlice } = createTestSlices();
      let computationCount = 0;

      const expensiveDerivation = sliceDerived(counterSlice, (counter) => {
        computationCount++;
        return `Count: ${counter.value()}`;
      });

      // Subscribe to ensure it's active
      const unsubscribe = expensiveDerivation.subscribe(() => {});

      expect(get(expensiveDerivation)).toBe('Count: 0');
      expect(computationCount).toBe(1);

      // Change counter - should trigger recomputation
      counterSlice().increment();
      expect(get(expensiveDerivation)).toBe('Count: 1');
      expect(computationCount).toBe(2);

      // Change user - should NOT trigger recomputation (fine-grained reactivity!)
      userSlice().setName('Alice');
      expect(get(expensiveDerivation)).toBe('Count: 1');
      expect(computationCount).toBe(2); // Still 2!

      unsubscribe();
    });
  });

  describe('combineSlices', () => {
    it('should combine multiple slices efficiently', () => {
      const { counterSlice, userSlice } = createTestSlices();

      const summary = combineSlices(
        [counterSlice, userSlice] as const,
        (counter, user) => `${user.name()}: ${counter.value()}`
      );

      // Subscribe to make it active
      const values: string[] = [];
      const unsubscribe = summary.subscribe((value) => values.push(value));

      expect(get(summary)).toBe('test: 0');

      // Update counter
      counterSlice().increment();
      expect(get(summary)).toBe('test: 1');

      // Update user
      userSlice().setName('Alice');
      expect(get(summary)).toBe('Alice: 1');

      expect(values).toEqual(['test: 0', 'test: 1', 'Alice: 1']);

      unsubscribe();
    });

    it('should only recalculate when relevant slices change', () => {
      const { counterSlice, userSlice, itemsSlice } = createTestSlices();
      let computationCount = 0;

      const summary = combineSlices(
        [counterSlice, userSlice] as const, // Only depends on counter and user, NOT items
        (counter, user) => {
          computationCount++;
          return `${user.name()}: ${counter.value()}`;
        }
      );

      // Subscribe to make it active
      const unsubscribe = summary.subscribe(() => {});

      expect(get(summary)).toBe('test: 0');
      expect(computationCount).toBe(1);

      // Change counter - should recalculate
      counterSlice().increment();
      expect(get(summary)).toBe('test: 1');
      expect(computationCount).toBe(2);

      // Change user - should recalculate
      userSlice().setName('Alice');
      expect(get(summary)).toBe('Alice: 1');
      expect(computationCount).toBe(3);

      // Change items - should NOT recalculate (fine-grained reactivity!)
      itemsSlice().add('item1');
      expect(get(summary)).toBe('Alice: 1');
      expect(computationCount).toBe(3); // Still 3!

      unsubscribe();
    });
  });

  describe('asyncDerived', () => {
    it('should handle async operations with loading states', async () => {
      const { userSlice } = createTestSlices();

      const userData = asyncDerived(userSlice, async (user) => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { email: `${user.name().toLowerCase()}@example.com` };
      });

      // Subscribe to make it active
      const states: any[] = [];
      const unsubscribe = userData.subscribe((state) =>
        states.push({ ...state })
      );

      // Initially should be loading since async operation starts immediately
      expect(get(userData).loading).toBe(true);

      // Wait for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 20));

      const result = get(userData);
      expect(result.loading).toBe(false);
      expect(result.error).toBe(null);
      expect(result.data).toEqual({ email: 'test@example.com' });

      unsubscribe();
    });

    it('should handle async errors', async () => {
      const { userSlice } = createTestSlices();

      const failingData = asyncDerived(userSlice, async () => {
        throw new Error('API Error');
      });

      // Subscribe to make it active
      const unsubscribe = failingData.subscribe(() => {});

      // Wait for async operation to fail
      await new Promise((resolve) => setTimeout(resolve, 20));

      const result = get(failingData);
      expect(result.loading).toBe(false);
      expect(result.data).toBe(undefined);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('API Error');

      unsubscribe();
    });
  });

  describe('memoized', () => {
    it('should memoize expensive computations', () => {
      const { counterSlice } = createTestSlices();
      let computationCount = 0;

      const expensiveStore = memoized(
        counterSlice,
        (counter) => {
          computationCount++;
          // Simpler expensive computation that's easier to verify
          return counter.value() * 100;
        }
      );

      // Subscribe to ensure the store is active
      const unsubscribe = expensiveStore.subscribe(() => {});

      // First computation (count = 0)
      const result1 = get(expensiveStore);
      expect(result1).toBe(0);
      expect(computationCount).toBe(1);

      // Same input - should use cache
      const result2 = get(expensiveStore);
      expect(result2).toBe(result1);
      expect(computationCount).toBe(1); // Still 1!

      // Different input - should recompute
      counterSlice().increment(); // count = 1
      const result3 = get(expensiveStore);
      expect(result3).toBe(100); // 1 * 100
      expect(result3).not.toBe(result1);
      expect(computationCount).toBe(2);

      // Different input again - should recompute
      counterSlice().increment(); // count = 2
      const result4 = get(expensiveStore);
      expect(result4).toBe(200); // 2 * 100
      expect(computationCount).toBe(3);

      unsubscribe();
    });

    it('should only recompute when slice dependencies change', () => {
      const { counterSlice, userSlice } = createTestSlices();
      let computationCount = 0;

      const expensiveStore = memoized(
        counterSlice,
        (counter) => {
          computationCount++;
          return counter.value() * 100;
        }
      );

      // Subscribe to ensure the store is active
      const unsubscribe = expensiveStore.subscribe(() => {});

      // Initial computation
      expect(get(expensiveStore)).toBe(0);
      expect(computationCount).toBe(1);

      // Multiple gets without slice changes - should use cache
      expect(get(expensiveStore)).toBe(0);
      expect(get(expensiveStore)).toBe(0);
      expect(computationCount).toBe(1); // Still 1!

      // Change unrelated slice - should NOT recompute
      userSlice().setName('Alice');
      expect(get(expensiveStore)).toBe(0);
      expect(computationCount).toBe(1); // Still 1!

      // Change relevant slice - should recompute
      counterSlice().increment();
      expect(get(expensiveStore)).toBe(100);
      expect(computationCount).toBe(2); // Now 2

      unsubscribe();
    });
  });
});
