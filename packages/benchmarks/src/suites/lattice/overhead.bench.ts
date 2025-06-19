/**
 * @fileoverview Overhead benchmarks - measure Lattice's impact on adapter performance
 *
 * Compares raw adapter usage vs adapter with Lattice wrapper
 */

import { describe, bench } from 'vitest';
import { createStore as createZustandStore } from 'zustand/vanilla';
import { create } from 'zustand';
import { zustandAdapter } from '@lattice/adapter-zustand';
import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import type { RuntimeSliceFactory } from '@lattice/core';

// Test iterations
const ITERATIONS = 10000;
const SUBSCRIPTION_COUNT = 100;

describe('Adapter Overhead', () => {
  describe('Zustand', () => {
    // Initialize stores outside benchmarks
    const rawStore = createZustandStore<{ count: number }>(() => ({ count: 0 }));
    const setCount = (count: number) => rawStore.setState({ count });
    
    const latticeStore = (() => {
      const useStore = create<{ count: number }>(() => ({ count: 0 }));
      const createSlice = zustandAdapter(useStore);
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ get, set }) => ({
          setCount: (count: number) => set({ count }),
          getCount: () => get().count,
        }));
        return { counter };
      };
      return createComponent(createSlice);
    })();

    bench('raw zustand - state updates', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        setCount(i);
      }
    });

    bench('zustand + lattice - state updates', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        latticeStore.counter.selector.setCount(i);
      }
    });

    // Initialize subscription test stores
    const rawSubStore = createZustandStore<{ count: number }>(() => ({ count: 0 }));
    const latticeSubStore = (() => {
      const useStore = create<{ count: number }>(() => ({ count: 0 }));
      const createSlice = zustandAdapter(useStore);
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ set }) => ({
          setCount: (count: number) => set({ count }),
        }));
        return { counter };
      };
      return createComponent(createSlice);
    })();

    bench('raw zustand - subscriptions', () => {
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(rawSubStore.subscribe(() => {}));
      }

      // Update state
      rawSubStore.setState({ count: Math.random() });

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });

    bench('zustand + lattice - subscriptions', () => {
      const unsubscribers: (() => void)[] = [];

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(latticeSubStore.counter.subscribe(() => {}));
      }

      // Update state
      latticeSubStore.counter.selector.setCount(Math.random());

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });
  });

  describe('Redux', () => {
    // Initialize Redux stores outside benchmarks
    const rawReduxStore = (() => {
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
        
      return { store, setCount };
    })();
    
    const latticeReduxStore = (() => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: { count: 0 },
      });
      const createSlice = reduxAdapter<{ count: number }>(store);
      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number }>
      ) => {
        const counter = createSlice(({ get, set }) => ({
          setCount: (count: number) => set({ count }),
          getCount: () => get().count,
        }));
        return { counter };
      };
      return createComponent(createSlice);
    })();

    bench('raw redux - state updates', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        rawReduxStore.setCount(i);
      }
    });

    bench('redux + lattice - state updates', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        latticeReduxStore.counter.selector.setCount(i);
      }
    });
  });

  describe('Progressive Overhead Analysis', () => {
    describe('State Updates - Layer by Layer', () => {
      // Pre-initialize all stores for fair comparison
      const directStore = createZustandStore<{ count: number }>(() => ({
        count: 0,
      }));
      
      const wrappedStore = (() => {
        const store = createZustandStore<{ count: number }>(() => ({
          count: 0,
        }));
        const setCount = (count: number) => store.setState({ count });
        return { setCount };
      })();
      
      const latticeWrappedStore = (() => {
        const useStore = create<{ count: number }>(() => ({ count: 0 }));
        const createSlice = zustandAdapter(useStore);
        const createComponent = (
          createSlice: RuntimeSliceFactory<{ count: number }>
        ) => {
          const counter = createSlice(({ set }) => ({
            setCount: (count: number) => set({ count }),
          }));
          return { counter };
        };
        return createComponent(createSlice);
      })();

      bench('zustand - direct setState()', () => {
        for (let i = 0; i < ITERATIONS; i++) {
          directStore.setState({ count: i });
        }
      });

      bench('zustand - function wrapped', () => {
        for (let i = 0; i < ITERATIONS; i++) {
          wrappedStore.setCount(i);
        }
      });

      bench('zustand - lattice wrapped', () => {
        for (let i = 0; i < ITERATIONS; i++) {
          latticeWrappedStore.counter.selector.setCount(i);
        }
      });
    });
  });

  describe('Store Creation Overhead', () => {
    bench('raw zustand - store creation only', () => {
      for (let i = 0; i < 1000; i++) {
        createZustandStore(() => ({ value: i }));
      }
    });

    bench('zustand + adapter - no component', () => {
      for (let i = 0; i < 1000; i++) {
        const value = i;
        const useStore = create<{ value: number }>(() => ({ value }));
        zustandAdapter(useStore);
      }
    });

    bench('zustand + lattice - full stack', () => {
      for (let i = 0; i < 1000; i++) {
        const value = i;
        const useStore = create<{ value: number }>(() => ({ value }));
        const createSlice = zustandAdapter(useStore);
        const createComponent = (
          createSlice: RuntimeSliceFactory<{ value: number }>
        ) => {
          const slice = createSlice(({ get }) => ({
            getValue: () => get().value,
          }));
          return { slice };
        };

        createComponent(createSlice);
      }
    });
  });
});
