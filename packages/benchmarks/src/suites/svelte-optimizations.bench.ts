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
import { createStore as createLatticeSvelteStore } from '@lattice/adapter-svelte';
import type { RuntimeSliceFactory } from '@lattice/core';

// Test iterations
const ITERATIONS = 10000;
const BATCH_SIZE = 1000;

describe('Svelte Adapter Optimizations', () => {
  describe('Direct Store Access Performance', () => {
    bench('raw svelte - state updates (baseline)', () => {
      const store = writable({ count: 0 });

      for (let i = 0; i < ITERATIONS; i++) {
        store.set({ count: i });
      }
    });

    bench('lattice standard - state updates', () => {
      const createSlice = createLatticeSvelteStore({ count: 0 });
      const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
        const counter = createSlice(({ set }) => ({
          setCount: (count: number) => set({ count }),
        }));
        return { counter };
      };
      const component = createComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        component.counter.selector.setCount(i);
      }
    });
  });

  describe('Batch Update Performance', () => {
    bench('lattice standard - multiple updates', () => {
      const createSlice = createLatticeSvelteStore({ count: 0 });
      const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
        const counter = createSlice(({ set }) => ({
          setCount: (count: number) => set({ count }),
        }));
        return { counter };
      };
      const component = createComponent(createSlice);

      for (let i = 0; i < BATCH_SIZE; i++) {
        component.counter.selector.setCount(i);
      }
    });
  });

  describe('Subscription Performance', () => {

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
        const createSlice = createLatticeSvelteStore({ value });
        const createComponent = (
          createSlice: RuntimeSliceFactory<{ value: number }>
        ) => {
          const slice = createSlice(({ get }) => ({
            getValue: () => get().value,
          }));
          return { slice };
        };

        stores.push(createComponent(createSlice));
      }
    });
  });
});
