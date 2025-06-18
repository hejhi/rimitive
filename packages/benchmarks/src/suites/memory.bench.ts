/**
 * @fileoverview Memory usage benchmarks
 *
 * Tests memory characteristics and potential leaks
 */

import { describe, bench } from 'vitest';
import { createStore as createZustandStore } from '@lattice/adapter-zustand';
import { createStore } from '@lattice/adapter-redux';
import { createStore as createStoreReactStore } from '@lattice/adapter-store-react';
import { LatticeStore, createSliceFactory } from '@lattice/adapter-svelte';
import type { RuntimeSliceFactory } from '@lattice/core';

// Helper for memory benchmarks that need dynamic state
function createSvelteStore<T extends Record<string, any>>(initialState: T): RuntimeSliceFactory<T> {
  // Create a dynamic store class
  class DynamicStore extends LatticeStore {
    constructor() {
      super();
      // Copy all properties from initial state
      Object.assign(this, initialState);
    }
  }
  
  const store = new DynamicStore();
  return createSliceFactory(store) as unknown as RuntimeSliceFactory<T>;
}

describe('Memory Usage Patterns', () => {
  describe('Large State Trees', () => {
    const createLargeInitialState = (size: number) => {
      // Create initial state with nested structure
      const initialState: any = {
          users: {},
          posts: {},
          comments: {},
          metadata: {
            counts: {},
            indexes: {},
            cache: {},
          },
        };

        // Populate with data
        for (let i = 0; i < size; i++) {
          initialState.users[`user-${i}`] = {
            id: `user-${i}`,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            profile: {
              bio: 'Lorem ipsum dolor sit amet',
              avatar: `https://example.com/avatar/${i}.jpg`,
              settings: {
                theme: 'dark',
                notifications: true,
                privacy: 'public',
              },
            },
          };

          initialState.posts[`post-${i}`] = {
            id: `post-${i}`,
            userId: `user-${i % 10}`,
            title: `Post ${i}`,
            content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            tags: [`tag-${i % 5}`, `category-${i % 3}`],
            stats: {
              views: Math.floor(Math.random() * 1000),
              likes: Math.floor(Math.random() * 100),
              shares: Math.floor(Math.random() * 50),
            },
          };

          initialState.metadata.counts[`count-${i}`] = i;
          initialState.metadata.indexes[`index-${i}`] = Array.from(
            { length: 10 },
            (_, j) => j
          );
      }

      return initialState;
    };

    const createLargeStateComponent =
      (_size: number) => (createSlice: RuntimeSliceFactory<any>) => {

        const users = createSlice(({ get, set }) => ({
          updateUser: (userId: string, updates: any) => {
            const users = { ...get().users };
            users[userId] = { ...users[userId], ...updates };
            set({ users });
          },
          getUser: (userId: string) => get().users[userId],
        }));

        const posts = createSlice(({ get, set }) => ({
          updatePost: (postId: string, updates: any) => {
            const posts = { ...get().posts };
            posts[postId] = { ...posts[postId], ...updates };
            set({ posts });
          },
          getPost: (postId: string) => get().posts[postId],
        }));

        return { users, posts };
      };

    bench('zustand - large state (1000 items)', () => {
      const initialState = createLargeInitialState(1000);
      const createSlice = createZustandStore(initialState);
      const store = createLargeStateComponent(1000)(createSlice);

      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.selector.updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        store.posts.selector.updatePost(`post-${i}`, {
          title: `Updated Post ${i}`,
        });
      }
    });

    bench('redux - large state (1000 items)', () => {
      const initialState = createLargeInitialState(1000);
      const { createSlice } = createStore(initialState);
      const store = createLargeStateComponent(1000)(createSlice);

      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.selector.updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        store.posts.selector.updatePost(`post-${i}`, {
          title: `Updated Post ${i}`,
        });
      }
    });

    bench('store-react - large state (1000 items)', () => {
      const initialState = createLargeInitialState(1000);
      const createSlice = createStoreReactStore(initialState);
      const store = createLargeStateComponent(1000)(createSlice);

      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.selector.updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        store.posts.selector.updatePost(`post-${i}`, {
          title: `Updated Post ${i}`,
        });
      }
    });

    bench('svelte - large state (1000 items)', () => {
      const initialState = createLargeInitialState(1000);
      const createSlice = createSvelteStore(initialState);
      const store = createLargeStateComponent(1000)(createSlice);

      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.selector.updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        store.posts.selector.updatePost(`post-${i}`, {
          title: `Updated Post ${i}`,
        });
      }
    });
  });

  describe('Subscription Memory Leaks', () => {
    bench('zustand - subscription cleanup', () => {
      const createComponent = (createSlice: RuntimeSliceFactory<{ value: number }>) => {
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value,
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const createSlice = createZustandStore({ value: 0 });
        const store = createComponent(createSlice);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.slice.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.selector.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach((unsubscribers) => {
        unsubscribers.forEach((unsub) => unsub());
      });

      // Destroy stores if possible
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });
    });

    bench('redux - subscription cleanup', () => {
      const createComponent = (createSlice: RuntimeSliceFactory<{ value: number }>) => {
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value,
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const { createSlice } = createStore({ value: 0 });
        const store = createComponent(createSlice);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.slice.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.selector.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach((unsubscribers) => {
        unsubscribers.forEach((unsub) => unsub());
      });

      // Destroy stores if possible
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });
    });

    bench('store-react - subscription cleanup', () => {
      const createComponent = (createSlice: RuntimeSliceFactory<{ value: number }>) => {
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value,
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const createSlice = createStoreReactStore({ value: 0 });
        const store = createComponent(createSlice);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.slice.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.selector.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach((unsubscribers) => {
        unsubscribers.forEach((unsub) => unsub());
      });

      // Destroy stores if possible
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });
    });

    bench('svelte - subscription cleanup', () => {
      const createComponent = (createSlice: RuntimeSliceFactory<{ value: number }>) => {
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value,
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const createSlice = createSvelteStore({ value: 0 });
        const store = createComponent(createSlice);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.slice.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.selector.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach((unsubscribers) => {
        unsubscribers.forEach((unsub) => unsub());
      });

      // Destroy stores - Svelte adapter has destroy method
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });
    });
  });

  describe('Rapid Store Creation/Destruction', () => {
    bench('zustand - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(({ get, set }: any) => ({
            update: (newValue: number) => {
              const history = [...get().history, get().value];
              set({ value: newValue, history });
            },
            getValue: () => get().value,
          }));
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const createSlice = createZustandStore({ value: i, history: [] as number[] });
        const store = createComponent(i)(createSlice);

        // Do some work
        store.slice.selector.update(i * 2);
        store.slice.selector.update(i * 3);
        totalValue += store.slice.selector.getValue();

        // Add and remove subscription
        const unsub = store.slice.subscribe(() => {});
        unsub();

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }
    });

    bench('redux - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(({ get, set }: any) => ({
            update: (newValue: number) => {
              const history = [...get().history, get().value];
              set({ value: newValue, history });
            },
            getValue: () => get().value,
          }));
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const { createSlice } = createStore({ value: i, history: [] as number[] });
        const store = createComponent(i)(createSlice);

        // Do some work
        store.slice.selector.update(i * 2);
        store.slice.selector.update(i * 3);
        totalValue += store.slice.selector.getValue();

        // Add and remove subscription
        const unsub = store.slice.subscribe(() => {});
        unsub();

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }
    });

    bench('store-react - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(({ get, set }: any) => ({
            update: (newValue: number) => {
              const history = [...get().history, get().value];
              set({ value: newValue, history });
            },
            getValue: () => get().value,
          }));
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const createSlice = createStoreReactStore({ value: i, history: [] as number[] });
        const store = createComponent(i)(createSlice);

        // Do some work
        store.slice.selector.update(i * 2);
        store.slice.selector.update(i * 3);
        totalValue += store.slice.selector.getValue();

        // Add and remove subscription
        const unsub = store.slice.subscribe(() => {});
        unsub();

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }
    });

    bench('svelte - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(({ get, set }: any) => ({
            update: (newValue: number) => {
              const history = [...get().history, get().value];
              set({ value: newValue, history });
            },
            getValue: () => get().value,
          }));
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const createSlice = createSvelteStore({ value: i, history: [] as number[] });
        const store = createComponent(i)(createSlice);

        // Do some work
        store.slice.selector.update(i * 2);
        store.slice.selector.update(i * 3);
        totalValue += store.slice.selector.getValue();

        // Add and remove subscription
        const unsub = store.slice.subscribe(() => {});
        unsub();

        // Always destroy Svelte stores to clean up
        if ('destroy' in store && typeof store.destroy === 'function') {
          store.destroy();
        }
      }
    });
  });
});
