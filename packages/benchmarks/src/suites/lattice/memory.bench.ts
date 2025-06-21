/**
 * @fileoverview Memory usage benchmarks
 *
 * Tests memory characteristics and potential leaks
 */

import { describe, bench } from 'vitest';
import { create } from 'zustand';
import { zustandAdapter } from '@lattice/adapter-zustand';
import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import { createStore as createStoreReactStore } from '@lattice/adapter-store-react';
import type { RuntimeSliceFactory } from '@lattice/core';
import { getSliceMetadata } from '@lattice/core';


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

        const users = createSlice(
          (selectors) => ({ users: selectors.users }),
          ({ users }, set) => ({
            updateUser: (userId: string, updates: any) => {
              set(
                (selectors) => ({ users: selectors.users }),
                ({ users }) => {
                  const currentUsers = users?.() || {};
                  const updatedUsers = { ...currentUsers };
                  const existingUser = updatedUsers[userId] || {};
                  updatedUsers[userId] = { ...existingUser, ...updates };
                  return { users: updatedUsers };
                }
              );
            },
            getUser: (userId: string) => {
              const currentUsers = users?.();
              return currentUsers ? currentUsers[userId] : undefined;
            },
          })
        );

        const posts = createSlice(
          (selectors) => ({ posts: selectors.posts }),
          ({ posts }, set) => ({
            updatePost: (postId: string, updates: any) => {
              set(
                (selectors) => ({ posts: selectors.posts }),
                ({ posts }) => {
                  const currentPosts = posts?.() || {};
                  const updatedPosts = { ...currentPosts };
                  const existingPost = updatedPosts[postId] || {};
                  updatedPosts[postId] = { ...existingPost, ...updates };
                  return { posts: updatedPosts };
                }
              );
            },
            getPost: (postId: string) => {
              const currentPosts = posts?.();
              return currentPosts ? currentPosts[postId] : undefined;
            },
          })
        );

        return { users, posts };
      };

    bench('zustand - large state (1000 items)', () => {
      const initialState = createLargeInitialState(1000);
      const useStore = create<any>(() => initialState);
      const createSlice = zustandAdapter(useStore);
      const store = createLargeStateComponent(1000)(createSlice);

      // Perform updates
      for (let i = 0; i < 100; i++) {
        store.users().updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        store.posts().updatePost(`post-${i}`, {
          title: `Updated Post ${i}`,
        });
      }
    });

    bench('redux - large state (1000 items)', () => {
      const initialState = createLargeInitialState(1000);
      const store = configureStore({
        reducer: latticeReducer.reducer,
        preloadedState: initialState,
      });
      const createSlice = reduxAdapter<any>(store);
      const components = createLargeStateComponent(1000)(createSlice);

      // Perform updates
      for (let i = 0; i < 100; i++) {
        components.users().updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        components.posts().updatePost(`post-${i}`, {
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
        store.users().updateUser(`user-${i}`, {
          name: `Updated User ${i}`,
        });
        store.posts().updatePost(`post-${i}`, {
          title: `Updated Post ${i}`,
        });
      }
    });

  });

  describe('Subscription Memory Leaks', () => {
    bench('zustand - subscription cleanup', () => {
      const createComponent = (createSlice: RuntimeSliceFactory<{ value: number }>) => {
        const slice = createSlice(
          (selectors) => ({ value: selectors.value }),
          ({ value }, set) => ({
            increment: () => set(
              (selectors) => ({ value: selectors.value }),
              ({ value }) => ({ value: value() + 1 })
            ),
            getValue: () => value(),
          })
        );
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const useStore = create<{ value: number }>(() => ({ value: 0 }));
        const createSlice = zustandAdapter(useStore);
        const store = createComponent(createSlice);
        stores.push(store);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        for (let j = 0; j < 10; j++) {
          const metadata = getSliceMetadata(store.slice);
          if (metadata?.subscribe) {
            unsubscribers.push(metadata.subscribe(() => {}));
          }
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice().increment();
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
        const slice = createSlice(
          (selectors) => ({ value: selectors.value }),
          ({ value }, set) => ({
            increment: () => set(
              (selectors) => ({ value: selectors.value }),
              ({ value }) => ({ value: value() + 1 })
            ),
            getValue: () => value(),
          })
        );
        return { slice };
      };

      const stores: any[] = [];
      const allUnsubscribers: (() => void)[][] = [];

      // Create many stores with subscriptions
      for (let i = 0; i < 100; i++) {
        const store = configureStore({
          reducer: latticeReducer.reducer,
          preloadedState: { value: 0 },
        });
        const createSlice = reduxAdapter<{ value: number }>(store);
        const component = createComponent(createSlice);
        stores.push(component);

        // Add subscriptions to each store
        const unsubscribers: (() => void)[] = [];
        const metadata = getSliceMetadata(component.slice);
        if (metadata?.subscribe) {
          for (let j = 0; j < 10; j++) {
            unsubscribers.push(metadata.subscribe(() => {}));
          }
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        component.slice().increment();
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
        const slice = createSlice(
          (selectors) => ({ value: selectors.value }),
          ({ value }, set) => ({
            increment: () => set(
              (selectors) => ({ value: selectors.value }),
              ({ value }) => ({ value: value() + 1 })
            ),
            getValue: () => value(),
          })
        );
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
          const metadata = getSliceMetadata(store.slice);
          if (metadata?.subscribe) {
            unsubscribers.push(metadata.subscribe(() => {}));
          }
        }
        allUnsubscribers.push(unsubscribers);

        // Trigger some updates
        store.slice().increment();
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

  });

  describe('Rapid Store Creation/Destruction', () => {
    bench('zustand - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(
            (selectors) => ({ value: selectors.value, history: selectors.history }),
            ({ value }, set) => ({
              update: (newValue: number) => {
                set(
                  (selectors) => ({ value: selectors.value, history: selectors.history }),
                  ({ value, history }) => ({ 
                    value: newValue, 
                    history: [...(history() || []), value()] 
                  })
                );
              },
              getValue: () => value(),
            })
          );
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const useStore = create<{ value: number; history: number[] }>(() => ({ value: i, history: [] }));
        const createSlice = zustandAdapter(useStore);
        const store = createComponent(i)(createSlice);

        // Do some work
        store.slice().update(i * 2);
        store.slice().update(i * 3);
        totalValue += store.slice().getValue();

        // Add and remove subscription
        const metadata = getSliceMetadata(store.slice);
        if (metadata?.subscribe) {
          const unsub = metadata.subscribe(() => {});
          unsub();
        }

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }
    });

    bench('redux - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(
            (selectors) => ({ value: selectors.value, history: selectors.history }),
            ({ value }, set) => ({
              update: (newValue: number) => {
                set(
                  (selectors) => ({ value: selectors.value, history: selectors.history }),
                  ({ value, history }) => ({ 
                    value: newValue, 
                    history: [...(history() || []), value()] 
                  })
                );
              },
              getValue: () => value(),
            })
          );
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const store = configureStore({
          reducer: latticeReducer.reducer,
          preloadedState: { value: i, history: [] as number[] },
        });
        const createSlice = reduxAdapter<{ value: number; history: number[] }>(store);
        const component = createComponent(i)(createSlice);

        // Do some work
        component.slice().update(i * 2);
        component.slice().update(i * 3);
        totalValue += component.slice().getValue();

        // Add and remove subscription
        const metadata = getSliceMetadata(component.slice);
        const unsub = metadata?.subscribe?.(() => {});
        if (unsub) unsub();

        // Destroy if possible
        if ((component as any).destroy) (component as any).destroy();
      }
    });

    bench('store-react - rapid lifecycle', () => {
      const createComponent =
        (_value: number) =>
        (createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>) => {
          const slice = createSlice(
            (selectors) => ({ value: selectors.value, history: selectors.history }),
            ({ value }, set) => ({
              update: (newValue: number) => {
                set(
                  (selectors) => ({ value: selectors.value, history: selectors.history }),
                  ({ value, history }) => ({ 
                    value: newValue, 
                    history: [...(history() || []), value()] 
                  })
                );
              },
              getValue: () => value(),
            })
          );
          return { slice };
        };

      let totalValue = 0;

      // Rapidly create and destroy stores
      for (let i = 0; i < 1000; i++) {
        const createSlice = createStoreReactStore({ value: i, history: [] as number[] });
        const store = createComponent(i)(createSlice);

        // Do some work
        store.slice().update(i * 2);
        store.slice().update(i * 3);
        totalValue += store.slice().getValue();

        // Add and remove subscription
        const metadata = getSliceMetadata(store.slice);
        if (metadata?.subscribe) {
          const unsub = metadata.subscribe(() => {});
          unsub();
        }

        // Destroy if possible
        if ((store as any).destroy) (store as any).destroy();
      }
    });

  });
});
