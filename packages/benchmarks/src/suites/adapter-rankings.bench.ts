/**
 * @fileoverview Adapter performance rankings
 *
 * Compares all Lattice adapters against each other
 */

import { describe, bench } from 'vitest';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import { createSvelteAdapter } from '@lattice/adapter-svelte';
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

// Standard component factory for all adapters
const createStandardComponent = (createStore: CreateStore<CountSlice>) => {
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
      const store = createZustandAdapter(createStandardComponent);

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
      const store = createReduxAdapter(createStandardComponent);

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

    bench('store-react adapter - updates', () => {
      const store = createStoreReactAdapter(createStandardComponent);

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

    bench('svelte adapter - updates', () => {
      const store = createSvelteAdapter(createStandardComponent);

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
      const store = createZustandAdapter(createStandardComponent);

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
      const store = createReduxAdapter(createStandardComponent);

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

    bench('store-react adapter - complex operations', () => {
      const store = createStoreReactAdapter(createStandardComponent);

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

    bench('svelte adapter - complex operations', () => {
      const store = createSvelteAdapter(createStandardComponent);

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
      const store = createZustandAdapter(createStandardComponent);
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
      const store = createReduxAdapter(createStandardComponent);
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

    bench('store-react adapter - subscriptions', () => {
      const store = createStoreReactAdapter(createStandardComponent);
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

    bench('svelte adapter - subscriptions', () => {
      const store = createSvelteAdapter(createStandardComponent);
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
      if ('destroy' in store && typeof store.destroy === 'function') {
        store.destroy();
      }
    });
  });

  describe('Store Creation Performance', () => {
    bench('zustand adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createZustandAdapter(createStandardComponent));
      }
    });

    bench('redux adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createReduxAdapter(createStandardComponent));
      }
    });

    bench('store-react adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createStoreReactAdapter(createStandardComponent));
      }
    });

    bench('svelte adapter - store creation', () => {
      const stores = [];

      for (let i = 0; i < 100; i++) {
        stores.push(createSvelteAdapter(createStandardComponent));
      }

      // Clean up to prevent memory leaks
      stores.forEach((store) => {
        if ('destroy' in store && typeof store.destroy === 'function') {
          store.destroy();
        }
      });
    });
  });
});
