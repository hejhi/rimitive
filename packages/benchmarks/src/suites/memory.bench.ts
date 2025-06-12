/**
 * @fileoverview Memory usage benchmarks
 * 
 * Tests memory characteristics and potential leaks
 */

import { describe, bench } from 'vitest';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import type { CreateStore } from '@lattice/core';

describe('Memory Usage Patterns', () => {
  describe('Large State Trees', () => {
    const createLargeStateApp = (size: number) => (createStore: CreateStore<any>) => {
      // Create initial state with nested structure
      const initialState: any = {
        users: {},
        posts: {},
        comments: {},
        metadata: {
          counts: {},
          indexes: {},
          cache: {}
        }
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
              privacy: 'public'
            }
          }
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
            shares: Math.floor(Math.random() * 50)
          }
        };

        initialState.metadata.counts[`count-${i}`] = i;
        initialState.metadata.indexes[`index-${i}`] = Array.from({ length: 10 }, (_, j) => j);
      }

      const createSlice = createStore(initialState);

      const users = createSlice(({ get, set }) => ({
        updateUser: (userId: string, updates: any) => {
          const users = { ...get().users };
          users[userId] = { ...users[userId], ...updates };
          set({ users });
        },
        getUser: (userId: string) => get().users[userId]
      }));

      const posts = createSlice(({ get, set }) => ({
        updatePost: (postId: string, updates: any) => {
          const posts = { ...get().posts };
          posts[postId] = { ...posts[postId], ...updates };
          set({ posts });
        },
        getPost: (postId: string) => get().posts[postId]
      }));

      return { users, posts };
    };

    bench('zustand - large state (1000 items)', () => {
      const store = createZustandAdapter(createLargeStateApp(1000));
      
      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.updateUser(`user-${i}`, { name: `Updated User ${i}` });
        store.posts.updatePost(`post-${i}`, { title: `Updated Post ${i}` });
      }
      
    });

    bench('redux - large state (1000 items)', () => {
      const store = createReduxAdapter(createLargeStateApp(1000));
      
      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.updateUser(`user-${i}`, { name: `Updated User ${i}` });
        store.posts.updatePost(`post-${i}`, { title: `Updated Post ${i}` });
      }
      
    });

    bench('store-react - large state (1000 items)', () => {
      const store = createStoreReactAdapter(createLargeStateApp(1000));
      
      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users.updateUser(`user-${i}`, { name: `Updated User ${i}` });
        store.posts.updatePost(`post-${i}`, { title: `Updated Post ${i}` });
      }
      
    });
  });

  describe('Subscription Memory Leaks', () => {
    bench('zustand - subscription cleanup', () => {
      const createApp = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const store = createZustandAdapter(createApp);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach(unsubscribers => {
        unsubscribers.forEach(unsub => unsub());
      });

      // Destroy stores if possible
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });

    });

    bench('redux - subscription cleanup', () => {
      const createApp = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const store = createReduxAdapter(createApp);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach(unsubscribers => {
        unsubscribers.forEach(unsub => unsub());
      });

      // Destroy stores if possible
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });

    });

    bench('store-react - subscription cleanup', () => {
      const createApp = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });
        const slice = createSlice(({ get, set }: any) => ({
          increment: () => set({ value: get().value + 1 }),
          getValue: () => get().value
        }));
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const store = createStoreReactAdapter(createApp);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          unsubscribers.push(store.subscribe(() => {}));
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice.increment();
      }

      // Cleanup all subscriptions
      allUnsubscribers.forEach(unsubscribers => {
        unsubscribers.forEach(unsub => unsub());
      });

      // Destroy stores if possible
      stores.forEach((store: any) => {
        if (store.destroy) store.destroy();
      });

    });
  });

  describe('Rapid Store Creation/Destruction', () => {
    bench('zustand - rapid lifecycle', () => {
      const createApp = (value: number) => (createStore: CreateStore<{ value: number; history: number[] }>) => {
        const createSlice = createStore({ value, history: [] as number[] });
        const slice = createSlice(({ get, set }: any) => ({
          update: (newValue: number) => {
            const history = [...get().history, get().value];
            set({ value: newValue, history });
          },
          getValue: () => get().value
        }));
        return { slice };
      };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const store = createZustandAdapter(createApp(i));
        
        // Do some work
        store.slice.update(i * 2);
        store.slice.update(i * 3);
        totalValue += store.slice.getValue();

        // Add and remove subscription
        const unsub = store.subscribe(() => {});
        unsub();

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }

    });

    bench('redux - rapid lifecycle', () => {
      const createApp = (value: number) => (createStore: CreateStore<{ value: number; history: number[] }>) => {
        const createSlice = createStore({ value, history: [] as number[] });
        const slice = createSlice(({ get, set }: any) => ({
          update: (newValue: number) => {
            const history = [...get().history, get().value];
            set({ value: newValue, history });
          },
          getValue: () => get().value
        }));
        return { slice };
      };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const store = createReduxAdapter(createApp(i));
        
        // Do some work
        store.slice.update(i * 2);
        store.slice.update(i * 3);
        totalValue += store.slice.getValue();

        // Add and remove subscription
        const unsub = store.subscribe(() => {});
        unsub();

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }

    });

    bench('store-react - rapid lifecycle', () => {
      const createApp = (value: number) => (createStore: CreateStore<{ value: number; history: number[] }>) => {
        const createSlice = createStore({ value, history: [] as number[] });
        const slice = createSlice(({ get, set }: any) => ({
          update: (newValue: number) => {
            const history = [...get().history, get().value];
            set({ value: newValue, history });
          },
          getValue: () => get().value
        }));
        return { slice };
      };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const store = createStoreReactAdapter(createApp(i));
        
        // Do some work
        store.slice.update(i * 2);
        store.slice.update(i * 3);
        totalValue += store.slice.getValue();

        // Add and remove subscription
        const unsub = store.subscribe(() => {});
        unsub();

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }

    });
  });
});