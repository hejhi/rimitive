/**
 * @fileoverview Adapter performance rankings
 *
 * Compares all Lattice adapters against each other
 */

import { describe, bench, afterAll } from 'vitest';
import { create } from 'zustand';
import { zustandAdapter } from '@lattice/adapter-zustand';
import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import { createStore as createStoreReactStore } from '@lattice/adapter-store-react';
import type { RuntimeSliceFactory } from '@lattice/core';

const ITERATIONS = 10000;
const SUBSCRIPTION_COUNT = 50;

type CountSlice = {
  count: number;
  items: string[];
  metadata: {
    lastUpdate: number;
    version: number;
  };
};

// Initial state for all benchmarks
const getInitialState = (): CountSlice => ({
  count: 0,
  items: [] as string[],
  metadata: {
    lastUpdate: Date.now(),
    version: 1,
  },
});

// Standard component factory for all adapters
const createStandardComponent = (
  createSlice: RuntimeSliceFactory<CountSlice>
) => {
  const counter = createSlice(
    (selectors) => ({ count: selectors.count }),
    ({ count }, set) => ({
      increment: () => set(
        (selectors) => ({ count: selectors.count }),
        ({ count }) => ({ count: count() + 1 })
      ),
      decrement: () => set(
        (selectors) => ({ count: selectors.count }),
        ({ count }) => ({ count: count() - 1 })
      ),
      getCount: () => count(),
    })
  );

  const items = createSlice(
    (selectors) => ({ items: selectors.items }),
    ({ items }, set) => ({
      addItem: (item: string) => set(
        (selectors) => ({ items: selectors.items }),
        ({ items }) => ({ items: [...items(), item] })
      ),
      removeItem: (index: number) => {
        set(
          (selectors) => ({ items: selectors.items }),
          ({ items }) => {
            const newItems = [...items()];
            newItems.splice(index, 1);
            return { items: newItems };
          }
        );
      },
      getItems: () => items(),
      getItemCount: () => items().length,
    })
  );

  const metadata = createSlice(
    (selectors) => ({ metadata: selectors.metadata }),
    ({ metadata }, set) => ({
      updateTimestamp: () =>
        set(
          (selectors) => ({ metadata: selectors.metadata }),
          ({ metadata }) => ({
            metadata: { ...metadata(), lastUpdate: Date.now() },
          })
        ),
      incrementVersion: () =>
        set(
          (selectors) => ({ metadata: selectors.metadata }),
          ({ metadata }) => ({
            metadata: { ...metadata(), version: metadata().version + 1 },
          })
        ),
      getMetadata: () => metadata(),
    })
  );

  return { counter, items, metadata };
};

describe('Adapter Performance Rankings', () => {
  // Pre-initialize stores for pure operation benchmarks
  const zustandStore = (() => {
    const useStore = create<CountSlice>(() => getInitialState());
    const createSlice = zustandAdapter(useStore);
    return createStandardComponent(createSlice);
  })();

  const reduxStore = (() => {
    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: getInitialState(),
    });
    const createSlice = reduxAdapter<CountSlice>(store);
    return createStandardComponent(createSlice);
  })();

  const storeReactStore = (() => {
    const createSlice = createStoreReactStore(getInitialState());
    return createStandardComponent(createSlice);
  })();

  // Warmup phase to allow JIT optimization
  const warmup = (store: any) => {
    for (let i = 0; i < 1000; i++) {
      store.counter().increment();
      if (i % 10 === 0) {
        store.items().addItem(`warmup-${i}`);
      }
    }
  };

  warmup(zustandStore);
  warmup(reduxStore);
  warmup(storeReactStore);

  describe('State Update Performance', () => {
    bench('zustand adapter - updates (init separated)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        zustandStore.counter().increment();
        if (i % 10 === 0) {
          zustandStore.items().addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          zustandStore.metadata().updateTimestamp();
        }
      }
    });

    bench('redux adapter - updates (init separated)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        reduxStore.counter().increment();
        if (i % 10 === 0) {
          reduxStore.items().addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          reduxStore.metadata().updateTimestamp();
        }
      }
    });

    bench('store-react adapter - updates (init separated)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        storeReactStore.counter().increment();
        if (i % 10 === 0) {
          storeReactStore.items().addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          storeReactStore.metadata().updateTimestamp();
        }
      }
    });

    // Keep the original benchmarks for comparison
    bench('zustand adapter - updates (with init)', () => {
      const useStore = create<CountSlice>(() => getInitialState());
      const createSlice = zustandAdapter(useStore);
      const store = createStandardComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter().increment();
        if (i % 10 === 0) {
          store.items().addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata().updateTimestamp();
        }
      }
    });

    bench('redux adapter - updates (with init)', () => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: getInitialState(),
      });
      const createSlice = reduxAdapter<CountSlice>(store);
      const components = createStandardComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        components.counter().increment();
        if (i % 10 === 0) {
          components.items().addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          components.metadata().updateTimestamp();
        }
      }
    });

    bench('store-react adapter - updates (with init)', () => {
      const createSlice = createStoreReactStore(getInitialState());
      const store = createStandardComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter().increment();
        if (i % 10 === 0) {
          store.items().addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata().updateTimestamp();
        }
      }
    });
  });

  describe('Complex State Operations', () => {
    // Pre-initialize stores for complex operations
    const zustandComplexStore = (() => {
      const useStore = create<CountSlice>(() => getInitialState());
      const createSlice = zustandAdapter(useStore);
      return createStandardComponent(createSlice);
    })();

    const reduxComplexStore = (() => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: getInitialState(),
      });
      const createSlice = reduxAdapter<CountSlice>(store);
      return createStandardComponent(createSlice);
    })();

    const storeReactComplexStore = (() => {
      const createSlice = createStoreReactStore(getInitialState());
      return createStandardComponent(createSlice);
    })();

    bench('zustand adapter - complex operations', () => {
      // Add items
      for (let i = 0; i < 100; i++) {
        zustandComplexStore.items().addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        zustandComplexStore.counter().increment();
        if (i % 2 === 0) {
          zustandComplexStore.items().removeItem(0);
        }
        zustandComplexStore.metadata().incrementVersion();
      }
    });

    bench('redux adapter - complex operations', () => {
      // Add items
      for (let i = 0; i < 100; i++) {
        reduxComplexStore.items().addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        reduxComplexStore.counter().increment();
        if (i % 2 === 0) {
          reduxComplexStore.items().removeItem(0);
        }
        reduxComplexStore.metadata().incrementVersion();
      }
    });

    bench('store-react adapter - complex operations', () => {
      // Add items
      for (let i = 0; i < 100; i++) {
        storeReactComplexStore.items().addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        storeReactComplexStore.counter().increment();
        if (i % 2 === 0) {
          storeReactComplexStore.items().removeItem(0);
        }
        storeReactComplexStore.metadata().incrementVersion();
      }
    });
  });

  describe('Subscription Performance', () => {
    // Pre-initialize stores and add subscriptions
    const setupSubscriptionBench = <T extends { counter: any }>(store: T) => {
      const unsubscribers: (() => void)[] = [];
      let notificationCount = 0;

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(
          store.counter.subscribe(() => {
            notificationCount++;
          })
        );
      }

      return {
        trigger: () => {
          // Reset notification count
          notificationCount = 0;
          // Trigger updates
          for (let i = 0; i < 100; i++) {
            store.counter().increment();
          }
          return notificationCount;
        },
        cleanup: () => {
          unsubscribers.forEach((unsub) => unsub());
        },
      };
    };

    const zustandSubStore = (() => {
      const useStore = create<CountSlice>(() => getInitialState());
      const createSlice = zustandAdapter(useStore);
      return createStandardComponent(createSlice);
    })();

    const reduxSubStore = (() => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: getInitialState(),
      });
      const createSlice = reduxAdapter<CountSlice>(store);
      return createStandardComponent(createSlice);
    })();

    const storeReactSubStore = (() => {
      const createSlice = createStoreReactStore(getInitialState());
      return createStandardComponent(createSlice);
    })();

    const zustandSub = setupSubscriptionBench(zustandSubStore);
    const reduxSub = setupSubscriptionBench(reduxSubStore);
    const storeReactSub = setupSubscriptionBench(storeReactSubStore);

    bench('zustand adapter - subscriptions', () => {
      zustandSub.trigger();
    });

    bench('redux adapter - subscriptions', () => {
      reduxSub.trigger();
    });

    bench('store-react adapter - subscriptions', () => {
      storeReactSub.trigger();
    });

    // Clean up after all benchmarks
    afterAll(() => {
      zustandSub.cleanup();
      reduxSub.cleanup();
      storeReactSub.cleanup();
    });
  });

  describe('Store Creation Performance', () => {
    // Measure pure adapter creation without component creation
    bench('zustand - pure adapter creation', () => {
      for (let i = 0; i < 100; i++) {
        const useStore = create<CountSlice>(() => getInitialState());
        zustandAdapter(useStore);
      }
    });

    bench('redux - pure adapter creation', () => {
      for (let i = 0; i < 100; i++) {
        const store = configureStore({
          reducer: latticeReducer.reducer,
          preloadedState: getInitialState(),
        });
        reduxAdapter<CountSlice>(store);
      }
    });

    bench('store-react - pure adapter creation', () => {
      for (let i = 0; i < 100; i++) {
        createStoreReactStore(getInitialState());
      }
    });

    // Measure full stack creation (for comparison with old benchmarks)
    bench('zustand - full stack creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        const useStore = create<CountSlice>(() => getInitialState());
        const createSlice = zustandAdapter(useStore);
        stores.push(createStandardComponent(createSlice));
      }
    });

    bench('redux - full stack creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        const store = configureStore({
          reducer: latticeReducer.reducer,
          preloadedState: getInitialState(),
        });
        const createSlice = reduxAdapter<CountSlice>(store);
        stores.push(createStandardComponent(createSlice));
      }
    });

    bench('store-react - full stack creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        const createSlice = createStoreReactStore(getInitialState());
        stores.push(createStandardComponent(createSlice));
      }
    });
  });
});
