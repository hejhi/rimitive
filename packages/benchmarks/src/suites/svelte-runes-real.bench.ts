/**
 * @fileoverview Svelte 5 Runes + Lattice performance benchmarks (using real compiled runes)
 *
 * Tests the performance of Lattice with real Svelte 5 runes by importing
 * pre-compiled Svelte modules.
 */

import { describe, bench } from 'vitest';
import { writable } from 'svelte/store';
import {
  createCounterStore,
  createComplexStore,
  createBatchStore,
  createDirectAccessStore,
} from '@lattice/adapter-svelte/dist/benchmark-store.js';

// Test iterations
const ITERATIONS = 10000;
const BATCH_SIZE = 1000;

describe('Svelte 5 Runes + Lattice Performance (Real)', () => {
  describe('State Update Performance', () => {
    bench('raw svelte store - state updates (baseline)', () => {
      const store = writable({ count: 0 });

      for (let i = 0; i < ITERATIONS; i++) {
        store.set({ count: i });
      }
    });

    bench('svelte runes direct - state updates', () => {
      const { setValue } = createDirectAccessStore();

      for (let i = 0; i < ITERATIONS; i++) {
        setValue(i);
      }
    });

    bench('lattice + runes - state updates', () => {
      const { component } = createCounterStore();

      for (let i = 0; i < ITERATIONS; i++) {
        component.counter.selector.setValue(i);
      }
    });

    bench('lattice + runes - increment operations', () => {
      const { component } = createCounterStore();

      for (let i = 0; i < ITERATIONS; i++) {
        component.counter.selector.increment();
      }
    });
  });

  describe('Complex State Updates', () => {
    bench('raw svelte store - complex updates', () => {
      const store = writable({
        user: { name: 'Test', age: 25 },
        items: ['a', 'b', 'c'],
        settings: { theme: 'light', notifications: true },
      });

      for (let i = 0; i < ITERATIONS / 10; i++) {
        store.update((state) => ({
          ...state,
          user: { ...state.user, age: i },
          items: [...state.items, `item${i}`],
        }));
      }
    });

    bench('lattice + runes - complex updates', () => {
      const { component } = createComplexStore();

      for (let i = 0; i < ITERATIONS / 10; i++) {
        component.user.selector.setAge(i);
        component.user.selector.addItem(`item${i}`);
      }
    });
  });

  describe('Batch Operations', () => {
    bench('raw svelte store - batch updates', () => {
      const store = writable({
        count: 0,
        total: 0,
        items: [] as number[],
      });

      for (let batch = 0; batch < 10; batch++) {
        store.update((state) => {
          const newItems = [];
          let newTotal = state.total;

          for (let i = 0; i < BATCH_SIZE; i++) {
            const value = batch * BATCH_SIZE + i;
            newItems.push(value);
            newTotal += value;
          }

          return {
            count: state.count + BATCH_SIZE,
            total: newTotal,
            items: [...state.items, ...newItems],
          };
        });
      }
    });

    bench('lattice + runes - batch updates', () => {
      const { component } = createBatchStore();

      for (let batch = 0; batch < 10; batch++) {
        component.batch.selector.processBatch(batch * BATCH_SIZE, BATCH_SIZE);
      }
    });
  });

  describe('Read Performance', () => {
    bench('raw svelte store - reads', () => {
      const store = writable({ count: 100 });
      let total = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        store.subscribe((value) => {
          total += value.count;
        })();
      }
    });

    bench('svelte runes direct - reads', () => {
      const { getValue } = createDirectAccessStore();
      let total = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        total += getValue();
      }
    });

    bench('lattice + runes - reads', () => {
      const { component } = createCounterStore();
      let total = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        total += component.counter.selector.value();
      }
    });
  });

  describe('Direct State Access vs Lattice Methods', () => {
    bench('direct state mutation (runes)', () => {
      const { setValue } = createDirectAccessStore();

      for (let i = 0; i < ITERATIONS; i++) {
        setValue(i);
      }
    });

    bench('lattice method calls (runes)', () => {
      const { component } = createCounterStore();

      for (let i = 0; i < ITERATIONS; i++) {
        component.counter.selector.setValue(i);
      }
    });

    bench('mixed approach - direct + lattice', () => {
      const direct = createDirectAccessStore();
      const lattice = createCounterStore();

      for (let i = 0; i < ITERATIONS / 2; i++) {
        // Direct mutation for simple updates
        direct.setValue(i);
        // Lattice for business logic
        lattice.component.counter.selector.increment();
      }
    });
  });

  describe('Memory and Creation', () => {
    bench('raw svelte stores - creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(writable({ value: i }));
      }
    });

    bench('svelte runes direct - creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createDirectAccessStore());
      }
    });

    bench('lattice + runes - creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createCounterStore());
      }
    });
  });
});
