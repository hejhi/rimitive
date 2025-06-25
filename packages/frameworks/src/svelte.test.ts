import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createStore, computed } from '@lattice/core';
import {
  slice,
  derived,
  combineSlices,
} from './svelte';

describe('Svelte utilities - New slice-based API', () => {
  // Create test slices
  const createTestSlices = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

    const counterSlice = createSlice(({ count }) => ({
      value: count, // count is already a signal
      increment: () => count(count() + 1),
      doubled: computed(() => count() * 2),
    }));

    const userSlice = createSlice(({ name }) => ({
      name, // name is already a signal
      setName: (newName: string) => name(newName),
    }));

    const itemsSlice = createSlice(({ items }) => ({
      all: items, // items is already a signal
      add: (item: string) => items([...items(), item]),
    }));

    return { counterSlice, userSlice, itemsSlice };
  };

  describe('slice', () => {
    it('should convert slice to Svelte store', () => {
      const { counterSlice } = createTestSlices();
      const counterStore = slice(counterSlice);

      // Initial value
      const counter = get(counterStore);
      expect(counter.value()).toBe(0);
      expect(counter.doubled()).toBe(0);

      // Update and check reactivity
      counter.increment();
      const updated = get(counterStore);
      expect(updated.value()).toBe(1);
      expect(updated.doubled()).toBe(2);
    });

    it('should be reactive to slice changes', () => {
      const { userSlice } = createTestSlices();
      const userStore = slice(userSlice);
      const values: string[] = [];

      // Subscribe to store changes
      const unsubscribe = userStore.subscribe((user) => {
        values.push(user.name());
      });

      // Change the name
      const user = get(userStore);
      user.setName('Alice');

      expect(values).toEqual(['test', 'Alice']);

      unsubscribe();
    });

    it('should work with selectors', () => {
      const { counterSlice } = createTestSlices();
      const countStore = slice(counterSlice, c => c.value());
      const doubledStore = slice(counterSlice, c => c.doubled());

      // Subscribe to ensure stores are active
      const values1: number[] = [];
      const values2: number[] = [];
      const unsub1 = countStore.subscribe(v => values1.push(v));
      const unsub2 = doubledStore.subscribe(v => values2.push(v));

      expect(get(countStore)).toBe(0);
      expect(get(doubledStore)).toBe(0);

      // Update counter
      counterSlice().increment();
      
      expect(get(countStore)).toBe(1);
      expect(get(doubledStore)).toBe(2);
      
      // Check subscription values
      expect(values1).toEqual([0, 1]);
      expect(values2).toEqual([0, 2]);
      
      unsub1();
      unsub2();
    });
  });

  describe('derived', () => {
    it('should create derived store from slice', () => {
      const { counterSlice } = createTestSlices();
      const doubled = derived(counterSlice, (counter) =>
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

      const expensiveDerivation = derived(counterSlice, (counter) => {
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
        { counter: counterSlice, user: userSlice },
        ({ counter, user }) => `${user.name()}: ${counter.value()}`
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
        { counter: counterSlice, user: userSlice }, // Only depends on counter and user, NOT items
        ({ counter, user }) => {
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


});
