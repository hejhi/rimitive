/**
 * @fileoverview Adapter performance rankings
 *
 * Compares all Lattice adapters against each other
 */

import { describe, bench } from 'vitest';
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
  const counter = createSlice(({ get, set }) => ({
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    getCount: () => get().count,
  }));

  const items = createSlice(({ get, set }) => ({
    addItem: (item: string) => set({ items: [...get().items, item] }),
    removeItem: (index: number) => {
      const newItems = [...get().items];
      newItems.splice(index, 1);
      set({ items: newItems });
    },
    getItems: () => get().items,
    getItemCount: () => get().items.length,
  }));

  const metadata = createSlice(({ get, set }) => ({
    updateTimestamp: () =>
      set({
        metadata: { ...get().metadata, lastUpdate: Date.now() },
      }),
    incrementVersion: () =>
      set({
        metadata: { ...get().metadata, version: get().metadata.version + 1 },
      }),
    getMetadata: () => get().metadata,
  }));

  return { counter, items, metadata };
};

describe('Adapter Performance Rankings', () => {
  describe('State Update Performance', () => {
    bench('zustand adapter - updates', () => {
      const useStore = create<CountSlice>(() => getInitialState());
      const createSlice = zustandAdapter(useStore);
      const store = createStandardComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.selector.increment();
        if (i % 10 === 0) {
          store.items.selector.addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata.selector.updateTimestamp();
        }
      }
    });

    bench('redux adapter - updates', () => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: getInitialState(),
      });
      const createSlice = reduxAdapter<CountSlice>(store);
      const components = createStandardComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        components.counter.selector.increment();
        if (i % 10 === 0) {
          components.items.selector.addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          components.metadata.selector.updateTimestamp();
        }
      }
    });

    bench('store-react adapter - updates', () => {
      const createSlice = createStoreReactStore(getInitialState());
      const store = createStandardComponent(createSlice);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.selector.increment();
        if (i % 10 === 0) {
          store.items.selector.addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata.selector.updateTimestamp();
        }
      }
    });
  });

  describe('Complex State Operations', () => {
    bench('zustand adapter - complex operations', () => {
      const useStore = create<CountSlice>(() => getInitialState());
      const createSlice = zustandAdapter(useStore);
      const store = createStandardComponent(createSlice);

      // Add items
      for (let i = 0; i < 100; i++) {
        store.items.selector.addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        store.counter.selector.increment();
        if (i % 2 === 0) {
          store.items.selector.removeItem(0);
        }
        store.metadata.selector.incrementVersion();
      }
    });

    bench('redux adapter - complex operations', () => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: getInitialState(),
      });
      const createSlice = reduxAdapter<CountSlice>(store);
      const components = createStandardComponent(createSlice);

      // Add items
      for (let i = 0; i < 100; i++) {
        components.items.selector.addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        components.counter.selector.increment();
        if (i % 2 === 0) {
          components.items.selector.removeItem(0);
        }
        components.metadata.selector.incrementVersion();
      }
    });

    bench('store-react adapter - complex operations', () => {
      const createSlice = createStoreReactStore(getInitialState());
      const store = createStandardComponent(createSlice);

      // Add items
      for (let i = 0; i < 100; i++) {
        store.items.selector.addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        store.counter.selector.increment();
        if (i % 2 === 0) {
          store.items.selector.removeItem(0);
        }
        store.metadata.selector.incrementVersion();
      }
    });
  });

  describe('Subscription Performance', () => {
    bench('zustand adapter - subscriptions', () => {
      const useStore = create<CountSlice>(() => getInitialState());
      const createSlice = zustandAdapter(useStore);
      const store = createStandardComponent(createSlice);
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

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        store.counter.selector.increment();
      }

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });

    bench('redux adapter - subscriptions', () => {
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: getInitialState(),
      });
      const createSlice = reduxAdapter<CountSlice>(store);
      const components = createStandardComponent(createSlice);
      const unsubscribers: (() => void)[] = [];
      let notificationCount = 0;

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(
          components.counter.subscribe(() => {
            notificationCount++;
          })
        );
      }

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        components.counter.selector.increment();
      }

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });

    bench('store-react adapter - subscriptions', () => {
      const createSlice = createStoreReactStore(getInitialState());
      const store = createStandardComponent(createSlice);
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

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        store.counter.selector.increment();
      }

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());
    });
  });

  describe('Store Creation Performance', () => {
    bench('zustand adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        const useStore = create<CountSlice>(() => getInitialState());
        const createSlice = zustandAdapter(useStore);
        stores.push(createStandardComponent(createSlice));
      }
    });

    bench('redux adapter - store creation', () => {
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

    bench('store-react adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        const createSlice = createStoreReactStore(getInitialState());
        stores.push(createStandardComponent(createSlice));
      }
    });
  });
});
