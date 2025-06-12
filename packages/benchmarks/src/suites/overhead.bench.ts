/**
 * @fileoverview Overhead benchmarks - measure Lattice's impact on adapter performance
 *
 * Compares raw adapter usage vs adapter with Lattice wrapper
 */

import { describe, bench } from 'vitest';
import { createStore as createZustandStore } from 'zustand/vanilla';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { configureStore } from '@reduxjs/toolkit';
import { createReduxAdapter } from '@lattice/adapter-redux';
import type { CreateStore } from '@lattice/core';

// Test iterations
const ITERATIONS = 10000;
const SUBSCRIPTION_COUNT = 100;

describe('Adapter Overhead', () => {
  describe('Zustand', () => {
    bench('raw zustand - state updates', () => {
      const store = createZustandStore<{ count: number }>(() => ({ count: 0 }));

      for (let i = 0; i < ITERATIONS; i++) {
        store.setState({ count: i });
      }
    });

    bench('zustand + lattice - state updates', () => {
      const createComponent = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });
        const counter = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          getCount: () => get().count,
        }));
        return { counter };
      };

      const store = createZustandAdapter(createComponent);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.increment();
      }
    });

    bench('raw zustand - subscriptions', () => {
      const store = createZustandStore<{ count: number }>(() => ({ count: 0 }));
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(store.subscribe(() => {}));
      }

      // Update state
      store.setState({ count: 1 });

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });

    bench('zustand + lattice - subscriptions', () => {
      const createComponent = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });
        const counter = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
        }));
        return { counter };
      };

      const store = createZustandAdapter(createComponent);
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(store.subscribe(() => {}));
      }

      // Update state
      store.counter.increment();

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });
  });

  describe('Redux', () => {
    bench('raw redux - state updates', () => {
      const slice = {
        name: 'counter',
        initialState: { count: 0 },
        reducers: {
          increment: (state: { count: number }) => {
            state.count += 1;
          },
        },
      };

      const store = configureStore({
        reducer: {
          [slice.name]: (state = slice.initialState, action: any) => {
            if (action.type === 'counter/increment') {
              return { count: (state as any).count + 1 };
            }
            return state;
          },
        },
      });

      for (let i = 0; i < ITERATIONS; i++) {
        store.dispatch({ type: 'counter/increment' });
      }
    });

    bench('redux + lattice - state updates', () => {
      const createComponent = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });
        const counter = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          getCount: () => get().count,
        }));
        return { counter };
      };

      const store = createReduxAdapter(createComponent);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.increment();
      }
    });
  });

  describe('Store Creation Overhead', () => {
    bench('raw zustand - store creation', () => {
      const stores = [];

      for (let i = 0; i < 1000; i++) {
        stores.push(createZustandStore(() => ({ value: i })));
      }
    });

    bench('zustand + lattice - store creation', () => {
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

        stores.push(createZustandAdapter(createComponent));
      }
    });
  });
});
