/**
 * @fileoverview Svelte-specific optimization benchmarks
 *
 * Tests the performance gains from Svelte adapter optimizations:
 * - Direct store access for hot paths
 * - Batch operations for bulk updates
 * - Perfect store contract compliance
 */

import { describe, bench } from 'vitest';
import { writable } from 'svelte/store';
import { createSvelteAdapter } from '@lattice/adapter-svelte';
import type { CreateStore } from '@lattice/core';

// Test iterations
const ITERATIONS = 10000;
const BATCH_SIZE = 1000;

describe('Svelte Adapter Optimizations', () => {
  describe('Direct Store Access Performance', () => {
    const createComponent = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });
      const counter = createSlice(({ set }) => ({
        setCount: (count: number) => set({ count }),
      }));
      return { counter };
    };

    bench('raw svelte - state updates (baseline)', () => {
      const store = writable({ count: 0 });

      for (let i = 0; i < ITERATIONS; i++) {
        store.set({ count: i });
      }
    });

    bench('lattice standard - state updates', () => {
      const store = createSvelteAdapter(createComponent);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.selector.setCount(i);
      }
    });

    bench('lattice optimized - direct store access', () => {
      const store = createSvelteAdapter(createComponent);
      const directStore = store.counter.adapter.$store;

      for (let i = 0; i < ITERATIONS; i++) {
        directStore.set({ count: i });
      }
    });
  });

  describe('Batch Update Performance', () => {
    const createComponent = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });
      const counter = createSlice(({ set }) => ({
        setCount: (count: number) => set({ count }),
      }));
      return { counter };
    };

    bench('lattice standard - multiple updates', () => {
      const store = createSvelteAdapter(createComponent);

      for (let i = 0; i < BATCH_SIZE; i++) {
        store.counter.selector.setCount(i);
      }
    });

    bench('lattice optimized - batched updates', () => {
      const store = createSvelteAdapter(createComponent);

      store.counter.adapter.$batch(() => {
        for (let i = 0; i < BATCH_SIZE; i++) {
          store.counter.selector.setCount(i);
        }
      });
    });
  });

  describe('Subscription Performance', () => {
    const createComponent = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });
      const counter = createSlice(({ set }) => ({
        setCount: (count: number) => set({ count }),
      }));
      return { counter };
    };

    bench('raw svelte - subscription handling', () => {
      const store = writable({ count: 0 });
      const unsubscribers: (() => void)[] = [];

      // Add 100 subscriptions
      for (let i = 0; i < 100; i++) {
        unsubscribers.push(store.subscribe(() => {}));
      }

      // Update state
      store.set({ count: 1 });

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });

    bench('lattice optimized - subscription handling', () => {
      const store = createSvelteAdapter(createComponent);
      const unsubscribers: (() => void)[] = [];

      // Add 100 subscriptions using perfect store contract
      for (let i = 0; i < 100; i++) {
        unsubscribers.push(store.counter.adapter.$store.subscribe(() => {}));
      }

      // Update state
      store.counter.adapter.$store.set({ count: 1 });

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });
  });

  describe('Store Creation Performance', () => {
    bench('raw svelte - store creation', () => {
      const stores = [];

      for (let i = 0; i < 1000; i++) {
        stores.push(writable({ value: i }));
      }
    });

    bench('lattice optimized - store creation', () => {
      const stores = [];

      for (let i = 0; i < 1000; i++) {
        const value = i;
        const createComponent = (
          createStore: CreateStore<{ value: number }>
        ) => {
          const createSlice = createStore({ value });
          const slice = createSlice(({ get }) => ({
            getValue: () => get().value,
          }));
          return { slice };
        };

        stores.push(createSvelteAdapter(createComponent));
      }

      // Clean up to prevent memory leaks
      stores.forEach((store: any) => {
        if ('destroy' in store.slice.adapter && typeof store.slice.adapter.destroy === 'function') {
          store.slice.adapter.destroy();
        }
      });
    });
  });
});