/**
 * @fileoverview Adapter performance rankings
 *
 * Compares all Lattice adapters against each other
 */

import { describe, bench } from 'vitest';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import type { CreateStore } from '@lattice/core';

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

// Standard app factory for all adapters
const createStandardApp = (createStore: CreateStore<CountSlice>) => {
  const createSlice = createStore({
    count: 0,
    items: [] as string[],
    metadata: {
      lastUpdate: Date.now(),
      version: 1,
    },
  });

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
      const store = createZustandAdapter(createStandardApp);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.increment();
        if (i % 10 === 0) {
          store.items.addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata.updateTimestamp();
        }
      }
    });

    bench('redux adapter - updates', () => {
      const store = createReduxAdapter(createStandardApp);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.increment();
        if (i % 10 === 0) {
          store.items.addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata.updateTimestamp();
        }
      }
    });

    bench('store-react adapter - updates', () => {
      const store = createStoreReactAdapter(createStandardApp);

      for (let i = 0; i < ITERATIONS; i++) {
        store.counter.increment();
        if (i % 10 === 0) {
          store.items.addItem(`item-${i}`);
        }
        if (i % 100 === 0) {
          store.metadata.updateTimestamp();
        }
      }
    });
  });

  describe('Complex State Operations', () => {
    bench('zustand adapter - complex operations', () => {
      const store = createZustandAdapter(createStandardApp);

      // Add items
      for (let i = 0; i < 100; i++) {
        store.items.addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        store.counter.increment();
        if (i % 2 === 0) {
          store.items.removeItem(0);
        }
        store.metadata.incrementVersion();
      }

    });

    bench('redux adapter - complex operations', () => {
      const store = createReduxAdapter(createStandardApp);

      // Add items
      for (let i = 0; i < 100; i++) {
        store.items.addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        store.counter.increment();
        if (i % 2 === 0) {
          store.items.removeItem(0);
        }
        store.metadata.incrementVersion();
      }

    });

    bench('store-react adapter - complex operations', () => {
      const store = createStoreReactAdapter(createStandardApp);

      // Add items
      for (let i = 0; i < 100; i++) {
        store.items.addItem(`item-${i}`);
      }

      // Update counter while removing items
      for (let i = 99; i >= 0; i--) {
        store.counter.increment();
        if (i % 2 === 0) {
          store.items.removeItem(0);
        }
        store.metadata.incrementVersion();
      }

    });
  });

  describe('Subscription Performance', () => {
    bench('zustand adapter - subscriptions', () => {
      const store = createZustandAdapter(createStandardApp);
      const unsubscribers: (() => void)[] = [];
      let notificationCount = 0;

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(
          store.subscribe(() => {
            notificationCount++;
          })
        );
      }

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        store.counter.increment();
      }

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());

    });

    bench('redux adapter - subscriptions', () => {
      const store = createReduxAdapter(createStandardApp);
      const unsubscribers: (() => void)[] = [];
      let notificationCount = 0;

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(
          store.subscribe(() => {
            notificationCount++;
          })
        );
      }

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        store.counter.increment();
      }

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());

    });

    bench('store-react adapter - subscriptions', () => {
      const store = createStoreReactAdapter(createStandardApp);
      const unsubscribers: (() => void)[] = [];
      let notificationCount = 0;

      // Add subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        unsubscribers.push(
          store.subscribe(() => {
            notificationCount++;
          })
        );
      }

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        store.counter.increment();
      }

      // Cleanup
      unsubscribers.forEach((unsub) => unsub());

    });
  });

  describe('Store Creation Performance', () => {
    bench('zustand adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createZustandAdapter(createStandardApp));
      }

    });

    bench('redux adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createReduxAdapter(createStandardApp));
      }

    });

    bench('store-react adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createStoreReactAdapter(createStandardApp));
      }

    });
  });
});
