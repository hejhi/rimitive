/**
 * @fileoverview React integration benchmarks for @lattice/store-react
 *
 * Measures React-specific performance characteristics including re-renders,
 * selector performance, and component update efficiency.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, bench } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import {
  useStore,
  createStoreContext,
  useStoreSelector,
  type StoreCreator,
  type StoreApi,
} from '@lattice/store/react';
import { create as createZustand } from 'zustand';
// import { shallow } from 'zustand/shallow'; // Not needed with current approach
import { act } from 'react';

describe('React Integration - Hook Performance', () => {
  {
    const setup = () => {
      const { result } = renderHook(() => {
        const store = useStore<{
          count: number;
          text: string;
          items: string[];
          increment: () => void;
          updateText: (text: string) => void;
          addItem: (item: string) => void;
        }>((set, get) => ({
          count: 0,
          text: '',
          items: [],
          increment: () => set({ count: get().count + 1 }),
          updateText: (text) => set({ text }),
          addItem: (item) => set({ items: [...get().items, item] }),
        }));
        return store;
      });
      return result;
    };

    let result: ReturnType<typeof setup>;

    bench(
      '@lattice/store-react - multiple state updates',
      () => {
        act(() => {
          // Multiple different state updates
          for (let i = 0; i < 100; i++) {
            result.current.increment();
            result.current.updateText(`text-${i}`);
            if (i % 10 === 0) {
              result.current.addItem(`item-${i}`);
            }
          }
        });
      },
      {
        setup: () => {
          result = setup();
        },
      }
    );
  }

  {
    const setup = () => {
      const useStore = createZustand<{
        count: number;
        text: string;
        items: string[];
        increment: () => void;
        updateText: (text: string) => void;
        addItem: (item: string) => void;
      }>((set, get) => ({
        count: 0,
        text: '',
        items: [],
        increment: () => set({ count: get().count + 1 }),
        updateText: (text) => set({ text }),
        addItem: (item) => set({ items: [...get().items, item] }),
      }));

      const { result } = renderHook(() => useStore());
      return result;
    };

    let result: ReturnType<typeof setup>;

    bench(
      'zustand - multiple state updates',
      () => {
        act(() => {
          // Multiple different state updates
          for (let i = 0; i < 100; i++) {
            result.current.increment();
            result.current.updateText(`text-${i}`);
            if (i % 10 === 0) {
              result.current.addItem(`item-${i}`);
            }
          }
        });
      },
      {
        setup: () => {
          result = setup();
        },
      }
    );
  }
});

describe('React Integration - Selector Performance', () => {
  // Simple zustand selector benchmark that avoids React 18 issues
  {
    const setup = () => {
      type SimpleState = {
        count: number;
        text: string;
        increment: () => void;
        setText: (text: string) => void;
      };

      const useStore = createZustand<SimpleState>((set) => ({
        count: 0,
        text: 'initial',
        increment: () => set((state) => ({ count: state.count + 1 })),
        setText: (text) => set({ text }),
      }));

      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        const count = useStore((s) => s.count);
        const text = useStore((s) => s.text);
        void count;
        void text;
        return null;
      };

      return {
        useStore,
        TestComponent,
        renderCount: () => renderCount,
      };
    };

    let ctx: ReturnType<typeof setup>;

    bench(
      'zustand - simple selector performance',
      () => {
        const { rerender } = render(<ctx.TestComponent />);
        const store = ctx.useStore.getState();

        act(() => {
          // Test selector performance with multiple updates
          for (let i = 0; i < 100; i++) {
            store.increment();
            if (i % 10 === 0) {
              store.setText(`text-${i}`);
            }
          }
        });

        rerender(<ctx.TestComponent />);
      },
      {
        setup: () => {
          ctx = setup();
        },
      }
    );
  }

  type ComplexState = {
    users: Record<
      string,
      { id: string; name: string; age: number; active: boolean }
    >;
    posts: Array<{
      id: string;
      userId: string;
      title: string;
      content: string;
    }>;
    settings: {
      theme: 'light' | 'dark';
      language: string;
      notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
      };
    };
    stats: {
      totalUsers: number;
      activeUsers: number;
      totalRevenue: number;
      averageOrderValue: number;
    };
    updateUser: (
      id: string,
      updates: Partial<ComplexState['users'][string]>
    ) => void;
    addPost: (post: ComplexState['posts'][0]) => void;
    updateSettings: (path: string, value: any) => void;
    recalculateStats: () => void;
  };

  const createInitialState = (): Omit<
    ComplexState,
    'updateUser' | 'addPost' | 'updateSettings' | 'recalculateStats'
  > => ({
    users: Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [
        `user-${i}`,
        {
          id: `user-${i}`,
          name: `User ${i}`,
          age: 20 + (i % 50),
          active: i % 3 !== 0,
        },
      ])
    ),
    posts: Array.from({ length: 500 }, (_, i) => ({
      id: `post-${i}`,
      userId: `user-${i % 100}`,
      title: `Post ${i}`,
      content: `Content for post ${i}`,
    })),
    settings: {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
    },
    stats: {
      totalUsers: 1000,
      activeUsers: 667,
      totalRevenue: 0,
      averageOrderValue: 0,
    },
  });

  // Create stable store creator function outside of benchmarks
  const createComplexStore: StoreCreator<ComplexState> = (set, get) => ({
    ...createInitialState(),
    updateUser: (id, updates) => {
      const user = get().users[id];
      if (user) {
        set({
          users: {
            ...get().users,
            [id]: { ...user, ...updates },
          },
        });
      }
    },
    addPost: (post) => set({ posts: [...get().posts, post] }),
    updateSettings: (path, value) => {
      // Simplified path update
      set({
        settings: {
          ...get().settings,
          theme: path === 'theme' ? value : get().settings.theme,
        },
      });
    },
    recalculateStats: () => {
      const users = Object.values(get().users);
      set({
        stats: {
          ...get().stats,
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.active).length,
        },
      });
    },
  });

  {
    const setup = () => {
      let renderCount = 0;
      let selectorExecutions = 0;

      // Define selectors outside component to avoid recreation
      const themeSelector = (s: ComplexState) => s.settings.theme;
      const totalUsersSelector = (s: ComplexState) => s.stats.totalUsers;
      const activeUsersOver30Selector = (s: ComplexState) =>
        Object.values(s.users).filter((u) => u.active && u.age > 30).length;

      // Component that uses selectors
      const TestComponent = ({
        store,
      }: {
        store: ComplexState & StoreApi<ComplexState>;
      }) => {
        renderCount++;

        // Use predefined selectors
        const theme = useStoreSelector(store, themeSelector);
        const totalUsers = useStoreSelector(store, totalUsersSelector);
        const activeUsersOver30 = useStoreSelector(
          store,
          activeUsersOver30Selector
        );

        // Track selector executions separately
        selectorExecutions += 3; // We know 3 selectors are called

        // Use the values to avoid unused warnings
        void theme;
        void totalUsers;
        void activeUsersOver30;

        return null;
      };

      const { result } = renderHook(() =>
        useStore<ComplexState>(createComplexStore)
      );
      const store = result.current;

      const { rerender } = render(<TestComponent store={store} />);

      return {
        store,
        rerender,
        TestComponent,
        renderCount: () => renderCount,
        selectorExecutions: () => selectorExecutions,
      };
    };

    let ctx: ReturnType<typeof setup>;

    bench(
      '@lattice/store-react - useStoreSelector performance',
      () => {
        // Measure selector performance during state updates
        act(() => {
          // Update users - should trigger selector re-execution
          for (let i = 0; i < 100; i++) {
            ctx.store.updateUser(`user-${i}`, { age: 35, active: true });
          }

          // Update unrelated state - selectors should not re-execute if properly memoized
          for (let i = 0; i < 50; i++) {
            ctx.store.addPost({
              id: `new-post-${i}`,
              userId: `user-${i}`,
              title: `New Post ${i}`,
              content: `New content ${i}`,
            });
          }

          // Update settings - only theme selector should re-execute
          ctx.store.updateSettings('theme', 'dark');
        });

        // Force a rerender to ensure selectors are called
        ctx.rerender(<ctx.TestComponent store={ctx.store} />);
      },
      {
        setup: () => {
          ctx = setup();
        },
      }
    );
  }

  // Benchmark: Computed values - idiomatic patterns for both libraries
  {
    // For @lattice/store-react: Direct computed selectors work out of the box
    const setupLattice = () => {
      let renderCount = 0;

      const TestComponent = ({
        store,
      }: {
        store: ComplexState & StoreApi<ComplexState>;
      }) => {
        renderCount++;

        // Direct computed selector - works perfectly with useStoreSelector
        const activeUsersOver30 = useStoreSelector(
          store,
          (s) =>
            Object.values(s.users).filter((u) => u.active && u.age > 30).length
        );

        void activeUsersOver30;
        return null;
      };

      const { result } = renderHook(() =>
        useStore<ComplexState>(createComplexStore)
      );
      const store = result.current;
      const { rerender } = render(<TestComponent store={store} />);

      return { store, rerender, TestComponent, renderCount: () => renderCount };
    };

    // For Zustand: Idiomatic approach with pre-computed values in store
    const setupZustand = () => {
      let renderCount = 0;

      interface ZustandComplexState extends ComplexState {
        activeUsersOver30Count: number;
        _updateComputedValues: () => void;
      }

      const useStore = createZustand<ZustandComplexState>((set, get) => ({
        ...createInitialState(),
        activeUsersOver30Count: 0,
        updateUser: (id, updates) => {
          const user = get().users[id];
          if (user) {
            set({
              users: {
                ...get().users,
                [id]: { ...user, ...updates },
              },
            });
            // Update computed values when state changes
            get()._updateComputedValues();
          }
        },
        addPost: (post) => set({ posts: [...get().posts, post] }),
        updateSettings: (path, value) => {
          set({
            settings: {
              ...get().settings,
              theme: path === 'theme' ? value : get().settings.theme,
            },
          });
        },
        recalculateStats: () => {
          const users = Object.values(get().users);
          set({
            stats: {
              ...get().stats,
              totalUsers: users.length,
              activeUsers: users.filter((u) => u.active).length,
            },
          });
        },
        _updateComputedValues: () => {
          const activeOver30 = Object.values(get().users).filter(
            (u) => u.active && u.age > 30
          ).length;
          set({ activeUsersOver30Count: activeOver30 });
        },
      }));

      const TestComponent = () => {
        renderCount++;
        // Simple selector for pre-computed value
        const activeUsersOver30 = useStore((s) => s.activeUsersOver30Count);
        void activeUsersOver30;
        return null;
      };

      // Initialize computed values
      useStore.getState()._updateComputedValues();

      const { rerender } = render(<TestComponent />);
      const store = useStore.getState();

      return { store, rerender, TestComponent, renderCount: () => renderCount };
    };

    let latticeCtx: ReturnType<typeof setupLattice>;
    let zustandCtx: ReturnType<typeof setupZustand>;

    bench(
      '@lattice/store-react - computed values (direct selectors)',
      () => {
        act(() => {
          for (let i = 0; i < 50; i++) {
            latticeCtx.store.updateUser(`user-${i}`, { age: 35, active: true });
          }
        });
        latticeCtx.rerender(
          <latticeCtx.TestComponent store={latticeCtx.store} />
        );
      },
      {
        setup: () => {
          latticeCtx = setupLattice();
        },
      }
    );

    bench(
      'zustand - computed values (pre-computed in store)',
      () => {
        act(() => {
          for (let i = 0; i < 50; i++) {
            zustandCtx.store.updateUser(`user-${i}`, { age: 35, active: true });
          }
        });
        zustandCtx.rerender(<zustandCtx.TestComponent />);
      },
      {
        setup: () => {
          zustandCtx = setupZustand();
        },
      }
    );
  }

  // Benchmark: Memoization effectiveness - testing if selectors avoid unnecessary recalculation
  {
    const setupMemoizationTest = (isZustand: boolean) => {
      let expensiveSelectorCalls = 0;
      let renderCount = 0;

      if (isZustand) {
        // Zustand approach with pre-computed expensive value
        interface ZustandStateWithExpensive extends ComplexState {
          topActiveUsersIds: string; // Comma-separated IDs for easy comparison
          _updateTopActiveUsers: () => void;
        }

        const useStore = createZustand<ZustandStateWithExpensive>(
          (set, get) => ({
            ...createInitialState(),
            topActiveUsersIds: '',
            updateUser: (id, updates) => {
              const user = get().users[id];
              if (user) {
                set({
                  users: {
                    ...get().users,
                    [id]: { ...user, ...updates },
                  },
                });
                // Only update expensive computation when users change
                get()._updateTopActiveUsers();
              }
            },
            addPost: (post) => set({ posts: [...get().posts, post] }),
            updateSettings: (path, value) => {
              set({
                settings: {
                  ...get().settings,
                  theme: path === 'theme' ? value : get().settings.theme,
                },
              });
              // Settings change should NOT trigger expensive computation
            },
            recalculateStats: () => {
              const users = Object.values(get().users);
              set({
                stats: {
                  ...get().stats,
                  totalUsers: users.length,
                  activeUsers: users.filter((u) => u.active).length,
                },
              });
            },
            _updateTopActiveUsers: () => {
              expensiveSelectorCalls++;
              const topUsers = Object.values(get().users)
                .filter((u) => u.active)
                .map((u) => ({
                  ...u,
                  posts: get().posts.filter((p) => p.userId === u.id),
                }))
                .sort((a, b) => b.posts.length - a.posts.length)
                .slice(0, 10);
              set({ topActiveUsersIds: topUsers.map((u) => u.id).join(',') });
            },
          })
        );

        const TestComponent = () => {
          renderCount++;
          const topActiveUsersIds = useStore((s) => s.topActiveUsersIds);
          void topActiveUsersIds;
          return null;
        };

        useStore.getState()._updateTopActiveUsers();
        const { rerender } = render(<TestComponent />);
        const store = useStore.getState();

        return {
          store,
          rerender: () => rerender(<TestComponent />),
          TestComponent,
          getExpensiveSelectorCalls: () => expensiveSelectorCalls,
        };
      } else {
        // @lattice/store-react approach with expensive selector
        const expensiveSelector = (state: ComplexState) => {
          expensiveSelectorCalls++;
          return Object.values(state.users)
            .filter((u) => u.active)
            .map((u) => ({
              ...u,
              posts: state.posts.filter((p) => p.userId === u.id),
            }))
            .sort((a, b) => b.posts.length - a.posts.length)
            .slice(0, 10)
            .map((u) => u.id)
            .join(','); // Return string for stable comparison
        };

        const TestComponent = ({
          store,
        }: {
          store: ComplexState & StoreApi<ComplexState>;
        }) => {
          renderCount++;
          const topActiveUsersIds = useStoreSelector(store, expensiveSelector);
          void topActiveUsersIds;
          return null;
        };

        const { result } = renderHook(() =>
          useStore<ComplexState>(createComplexStore)
        );
        const store = result.current;
        const { rerender } = render(<TestComponent store={store} />);

        return {
          store,
          rerender: () => rerender(<TestComponent store={store} />),
          TestComponent,
          getExpensiveSelectorCalls: () => expensiveSelectorCalls,
        };
      }
    };

    bench('@lattice/store-react - memoization effectiveness', () => {
      const ctx = setupMemoizationTest(false);

      act(() => {
        const initialCalls = ctx.getExpensiveSelectorCalls();

        // These updates should NOT trigger the expensive selector
        for (let i = 0; i < 50; i++) {
          ctx.store.updateSettings('theme', i % 2 === 0 ? 'light' : 'dark');
        }

        const callsAfterUnrelatedUpdates = ctx.getExpensiveSelectorCalls();

        // These updates SHOULD trigger the expensive selector
        for (let i = 0; i < 10; i++) {
          const store = ctx.store as ComplexState & StoreApi<ComplexState>;
          const user = store.getState().users[`user-${i}`];
          if (user) {
            ctx.store.updateUser(`user-${i}`, {
              active: !user.active,
            });
          }
        }

        const finalCalls = ctx.getExpensiveSelectorCalls();

        // Verify memoization is working
        if (callsAfterUnrelatedUpdates > initialCalls) {
          console.warn('Lattice: Selector called for unrelated updates');
        }
        if (finalCalls === callsAfterUnrelatedUpdates) {
          console.warn('Lattice: Selector not called for relevant updates');
        }
      });

      ctx.rerender();
    });

    bench('zustand - memoization effectiveness (pre-computed)', () => {
      const ctx = setupMemoizationTest(true);

      act(() => {
        const initialCalls = ctx.getExpensiveSelectorCalls();

        // These updates should NOT trigger the expensive computation
        for (let i = 0; i < 50; i++) {
          ctx.store.updateSettings('theme', i % 2 === 0 ? 'light' : 'dark');
        }

        const callsAfterUnrelatedUpdates = ctx.getExpensiveSelectorCalls();

        // These updates SHOULD trigger the expensive computation
        for (let i = 0; i < 10; i++) {
          ctx.store.updateUser(`user-${i}`, {
            active: !ctx.store.users[`user-${i}`]?.active,
          });
        }

        const finalCalls = ctx.getExpensiveSelectorCalls();

        // Verify memoization is working
        if (callsAfterUnrelatedUpdates > initialCalls) {
          console.warn('Zustand: Computation called for unrelated updates');
        }
        if (finalCalls === callsAfterUnrelatedUpdates) {
          console.warn('Zustand: Computation not called for relevant updates');
        }
      });

      ctx.rerender();
    });
  }
});

describe('React Integration - Subscription Management', () => {
  {
    const setup = () => {
      // Create a store context to share one store across multiple components
      const StoreContext = createStoreContext<{
        value: number;
        update: (n: number) => void;
      }>();

      // Create the actual store instance
      const { result: storeResult } = renderHook(() =>
        useStore<{
          value: number;
          update: (n: number) => void;
        }>((set) => ({
          value: 0,
          update: (n) => set({ value: n }),
        }))
      );

      // Component that subscribes to the shared store
      const SubscriberComponent = () => {
        const store = StoreContext.useStore();
        // Force a render when store updates
        useStoreSelector(store, (s) => s.value);
        return null;
      };

      // Render many subscriber components within the provider
      const { unmount } = render(
        <StoreContext.Provider value={storeResult.current}>
          {Array.from({ length: 50 }, (_, i) => (
            <SubscriberComponent key={i} />
          ))}
        </StoreContext.Provider>
      );

      return { store: storeResult.current, unmount };
    };

    let ctx: ReturnType<typeof setup>;

    bench(
      '@lattice/store-react - many subscriptions',
      () => {
        // Update the store (all subscribers should receive updates)
        act(() => {
          for (let j = 0; j < 100; j++) {
            ctx.store.update(j);
          }
        });
      },
      {
        setup: () => {
          ctx = setup();
        },
        teardown: () => {
          ctx?.unmount();
        },
      }
    );
  }

  {
    const setup = () => {
      // Create ONE store that will have many subscribers
      const useZustandStore = createZustand<{
        value: number;
        update: (n: number) => void;
      }>((set) => ({
        value: 0,
        update: (n) => set({ value: n }),
      }));

      // Component that subscribes to the store
      const SubscriberComponent = () => {
        const value = useZustandStore((s) => s.value);
        void value; // Subscribe to value changes
        return null;
      };

      // Store reference to update from outside
      let updateFn: ((n: number) => void) | null = null;

      const UpdateCapture = () => {
        const update = useZustandStore((s) => s.update);
        updateFn = update;
        return null;
      };

      // Render many subscriber components
      const { unmount } = render(
        <>
          <UpdateCapture />
          {Array.from({ length: 50 }, (_, i) => (
            <SubscriberComponent key={i} />
          ))}
        </>
      );

      if (!updateFn) {
        throw new Error('updateFn not captured');
      }

      return { updateFn: updateFn as (n: number) => void, unmount };
    };

    let ctx: ReturnType<typeof setup>;

    bench(
      'zustand - many subscriptions',
      () => {
        // Update the store (all subscribers should receive updates)
        act(() => {
          for (let j = 0; j < 100; j++) {
            ctx.updateFn(j);
          }
        });
      },
      {
        setup: () => {
          ctx = setup();
        },
        teardown: () => {
          ctx?.unmount();
        },
      }
    );
  }
});
