import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createSvelteStore, computed } from '@lattice/core';
import { useSlice } from './svelte';


describe('Svelte utilities - New slice-based API', () => {
  // Create test slices
  const createTestSlices = () => {
    const createSlice = createSvelteStore({
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

  describe('useSlice', () => {
    it('should convert slice to Svelte store', () => {
      const { counterSlice } = createTestSlices();
      const counterStore = useSlice(counterSlice);

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
      const userStore = useSlice(userSlice);
      const values: string[] = [];

      // Subscribe to the store to track changes
      const unsubscribe = userStore.subscribe((user) => {
        values.push(user.name());
      });
      
      // Change the name
      const user = get(userStore);
      user.setName('Alice');

      expect(values).toEqual(['test', 'Alice']);

      unsubscribe();
    });

    it('should work with signals directly as stores', () => {
      const { counterSlice } = createTestSlices();
      const counterStore = useSlice(counterSlice);
      
      // Get the counter object from the store
      const counter = get(counterStore);
      
      // Signals are stores, so we can use them directly
      expect(counter.value()).toBe(0);
      expect(counter.doubled()).toBe(0);
      
      // Subscribe to track changes
      const values: number[] = [];
      const unsubscribe = counter.value.subscribe(() => {
        values.push(counter.value());
      });
      
      // Update counter
      counter.increment();
      
      expect(counter.value()).toBe(1);
      expect(counter.doubled()).toBe(2);
      
      // Check subscription was notified
      expect(values).toEqual([1]);
      
      unsubscribe();
    });
  });




});
