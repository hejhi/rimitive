/**
 * @fileoverview Overhead benchmarks - measure Lattice's impact on adapter performance
 *
 * Compares raw adapter usage vs adapter with Lattice wrapper
 */

import { describe, bench } from 'vitest';
import { createStore as createZustandStore } from 'zustand/vanilla';
import { createStore as createLatticeZustandStore } from '@lattice/adapter-zustand';
import { configureStore } from '@reduxjs/toolkit';
import { createStore as createLatticeReduxStore } from '@lattice/adapter-redux';
import { writable } from 'svelte/store';
import { createStore as createLatticeSvelteStore } from '@lattice/adapter-svelte';
import type { RuntimeSliceFactory } from '@lattice/core';

// Test iterations
const ITERATIONS = 10000;
const SUBSCRIPTION_COUNT = 100;

describe('Adapter Overhead', () => {
  describe('Zustand', () => {
    bench('raw zustand - state updates', () => {
      const store = createZustandStore<{ count: number }>(() => ({ count: 0 }));
      const setCount = (count: number) => store.setState({ count });

      for (let i = 0; i < ITERATIONS; i++) {
        setCount(i);
      }
    });

    bench('zustand + lattice - state updates', () => {
      const createSlice = createLatticeZustandStore({ count: 0 });
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ get, set }) => ({
          setCount: (count: number) => set({ count }),
          getCount: () => get().count,
        }));
        return { counter };
      };
      const component = createComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        component.counter.selector.setCount(i);
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
      const createSlice = createLatticeZustandStore({ count: 0 });
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ set }) => ({
          setCount: (count: number) => set({ count }),
        }));
        return { counter };
      };
      const component = createComponent(createSlice);
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(component.counter.subscribe(() => {}));
      }

      // Update state
      component.counter.selector.setCount(1);

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
          setCount: (state: { count: number }, action: { payload: number }) => {
            state.count = action.payload;
          },
        },
      };

      const store = configureStore({
        reducer: {
          [slice.name]: (state = slice.initialState, action: any) => {
            if (action.type === 'counter/setCount') {
              return { count: action.payload };
            }
            return state;
          },
        },
      });

      const setCount = (count: number) =>
        store.dispatch({ type: 'counter/setCount', payload: count });

      for (let i = 0; i < ITERATIONS; i++) {
        setCount(i);
      }
    });

    bench('redux + lattice - state updates', () => {
      const createSlice = createLatticeReduxStore({ count: 0 });
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ get, set }) => ({
          setCount: (count: number) => set({ count }),
          getCount: () => get().count,
        }));
        return { counter };
      };
      const component = createComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        component.counter.selector.setCount(i);
      }
    });
  });

  describe('Svelte', () => {
    bench('raw svelte - state updates', () => {
      const store = writable({ count: 0 });
      const setCount = (count: number) => store.set({ count });

      for (let i = 0; i < ITERATIONS; i++) {
        setCount(i);
      }
    });

    bench('svelte + lattice - state updates', () => {
      // For benchmarking, we use a plain object instead of Svelte runes
      const createSlice = createLatticeSvelteStore({ count: 0 });
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
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


    bench('raw svelte - subscriptions', () => {
      const store = writable({ count: 0 });
      const setCount = (count: number) => store.set({ count });
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(store.subscribe(() => {}));
      }

      // Update state
      setCount(1);

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });

    bench('svelte + lattice - subscriptions', () => {
      const createSlice = createLatticeSvelteStore({ count: 0 });
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ set }) => ({
          setCount: (count: number) => set({ count }),
        }));
        return { counter };
      };
      const component = createComponent(createSlice);
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(component.counter.subscribe(() => {}));
      }

      // Update state
      component.counter.selector.setCount(1);

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });
  });

  describe('Progressive Overhead Analysis', () => {
    describe('State Updates - Layer by Layer', () => {
      // Svelte progressive benchmarks
      bench('svelte - direct store.set()', () => {
        const store = writable({ count: 0 });
        for (let i = 0; i < ITERATIONS; i++) {
          store.set({ count: i });
        }
      });

      bench('svelte - function wrapped', () => {
        const store = writable({ count: 0 });
        const setCount = (count: number) => store.set({ count });
        for (let i = 0; i < ITERATIONS; i++) {
          setCount(i);
        }
      });

      bench('svelte - lattice wrapped', () => {
        const createSlice = createLatticeSvelteStore({ count: 0 });
        const createComponent = (
          createSlice: RuntimeSliceFactory<{ count: number }>
        ) => {
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

      // Zustand progressive benchmarks
      bench('zustand - direct setState()', () => {
        const store = createZustandStore<{ count: number }>(() => ({
          count: 0,
        }));
        for (let i = 0; i < ITERATIONS; i++) {
          store.setState({ count: i });
        }
      });

      bench('zustand - function wrapped', () => {
        const store = createZustandStore<{ count: number }>(() => ({
          count: 0,
        }));
        const setCount = (count: number) => store.setState({ count });
        for (let i = 0; i < ITERATIONS; i++) {
          setCount(i);
        }
      });

      bench('zustand - lattice wrapped', () => {
        const createSlice = createLatticeZustandStore({ count: 0 });
        const createComponent = (
          createSlice: RuntimeSliceFactory<{ count: number }>
        ) => {
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
        const createSlice = createLatticeZustandStore({ value });
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

    bench('raw svelte - store creation', () => {
      const stores = [];

      for (let i = 0; i < 1000; i++) {
        stores.push(writable({ value: i }));
      }
    });

    bench('svelte + lattice - store creation', () => {
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
