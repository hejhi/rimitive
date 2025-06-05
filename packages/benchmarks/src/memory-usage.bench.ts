/**
 * @fileoverview Memory usage benchmarks
 * 
 * Tests memory efficiency of Lattice patterns:
 * - Memory overhead of slice creation
 * - Memory impact of compose chains
 * - Subscription memory footprint
 * - Cleanup effectiveness
 */

import { bench, describe } from 'vitest';
import { createComponent, createModel, createSlice, compose, type SliceFactory } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

describe('Memory Usage Patterns', () => {
  // Helper to create many slices
  const createManySlices = (count: number) => {
    const model = createModel<{ data: Record<string, number> }>(() => ({
      data: {},
    }));

    const slices: Array<SliceFactory<{ data: Record<string, number> }, { value: number; exists: boolean; }>> = [];
    
    for (let i = 0; i < count; i++) {
      const slice = createSlice(model, (m) => ({
        value: m.data[`key${i}`] || 0,
        exists: `key${i}` in m.data,
      }));
      slices.push(slice);
    }
    
    return { model, slices };
  };

  bench('Create 1000 simple slices', () => {
    createManySlices(1000);
  });

  bench('Create 1000 composed slices (1 level)', () => {
    const model = createModel<{ values: number[] }>(() => ({
      values: Array(100).fill(0),
    }));

    const baseSlices = Array.from({ length: 100 }, (_, i) =>
      createSlice(model, (m) => m.values[i] || 0)
    );

    // Create 1000 slices that compose the base slices
    Array.from({ length: 1000 }, (_, i) => {
      const baseIndex = i % 100;
      return createSlice(
        model,
        compose(
          { base: baseSlices[baseIndex]! },
          (_, { base }) => ({
            doubled: base * 2,
            tripled: base * 3,
            original: base,
          })
        )
      );
    });

    // Return nothing for benchmark
  });

  bench('Create deep compose chain (10 levels)', () => {
    const model = createModel<{ value: number }>(() => ({
      value: 42,
    }));

    let currentSlice: SliceFactory<{ value: number }, any> = createSlice(model, (m) => m.value);
    
    // Create a chain of 10 composed slices
    for (let i = 0; i < 10; i++) {
      const prevSlice = currentSlice;
      currentSlice = createSlice(
        model,
        compose({ prev: prevSlice }, (_, { prev }) => ({
          level: i + 1,
          value: typeof prev === 'number' ? prev * (i + 1) : prev.value * (i + 1),
          accumulated: prev,
        }))
      );
    }
    
    // Execute the final slice for benchmark
    currentSlice({ value: 42 });
  });

  bench('Store with 100 subscriptions - creation and cleanup', () => {
    const component = createComponent(() => {
      const model = createModel<{
        counters: Record<string, number>;
        increment: (key: string) => void;
      }>(({ set, get }) => ({
        counters: {},
        increment: (key) => {
          const { counters } = get();
          set({
            counters: {
              ...counters,
              [key]: (counters[key] || 0) + 1,
            },
          });
        },
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
      }));

      // Create 100 different views
      const views: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        views[`counter${i}`] = createSlice(model, (m) => ({
          value: m.counters[`counter${i}`] || 0,
        }));
      }

      return { model, actions, views };
    });

    const store = createZustandAdapter(component);
    const unsubscribes: Array<() => void> = [];
    
    // Create 100 subscriptions
    for (let i = 0; i < 100; i++) {
      const viewName = `counter${i}`;
      const unsub = store.subscribe(
        (views) => (views as any)[viewName](),
        () => {} // No-op
      );
      unsubscribes.push(unsub);
    }
    
    // Cleanup all subscriptions
    unsubscribes.forEach((unsub) => unsub());
    store.destroy();
  });

  bench('Large model state (1MB) - slice access', () => {
    // Create a model with ~1MB of data
    const largeArray = Array.from({ length: 25000 }, (_, i) => ({
      id: i,
      value: Math.random(),
      name: `Item ${i}`,
      metadata: { created: Date.now(), updated: Date.now() },
    }));

    const model = createModel<{
      data: typeof largeArray;
      summary: { total: number; average: number };
    }>(() => ({
      data: largeArray,
      summary: { total: 0, average: 0 },
    }));

    // Create slices that access different parts
    const firstItemSlice = createSlice(model, (m) => m.data[0]);
    const lastItemSlice = createSlice(model, (m) => m.data[m.data.length - 1]);
    const summarySlice = createSlice(model, (m) => m.summary);
    
    // Create a computed slice
    const statsSlice = createSlice(model, (m) => ({
      count: m.data.length,
      firstId: m.data[0]?.id,
      lastId: m.data[m.data.length - 1]?.id,
    }));

    // Execute slices
    const testData = {
      data: largeArray,
      summary: { total: 1000, average: 4 },
    };
    
    firstItemSlice(testData);
    lastItemSlice(testData);
    summarySlice(testData);
    statsSlice(testData);
  });

  bench('Subscription memory - rapid subscribe/unsubscribe cycles', () => {
    const component = createComponent(() => {
      const model = createModel<{ value: number; increment: () => void }>(
        ({ set, get }) => ({
          value: 0,
          increment: () => set({ value: get().value + 1 }),
        })
      );

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
      }));

      const views = {
        value: createSlice(model, (m) => ({ count: m.value })),
      };

      return { model, actions, views };
    });

    const store = createZustandAdapter(component);
    
    // Perform 100 rapid subscribe/unsubscribe cycles
    for (let i = 0; i < 100; i++) {
      const unsub = store.subscribe(
        (views) => views.value(),
        () => {} // No-op
      );
      
      // Trigger an update
      store.actions.increment();
      
      // Immediately unsubscribe
      unsub();
    }
    
    store.destroy();
  });
});