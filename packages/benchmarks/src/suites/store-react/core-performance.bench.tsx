/**
 * @fileoverview Core performance benchmarks for @lattice/store-react
 * 
 * Measures fundamental operations like store creation, state updates,
 * and subscription handling to establish baseline performance metrics.
 */

import { describe, bench } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '@lattice/store-react';
import { create as createZustand } from 'zustand';

describe('Core Performance - Store Creation', () => {
  bench('@lattice/store-react - create store with hook', () => {
    renderHook(() => 
      useStore<{ count: number; increment: () => void }>((set, get) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 })
      }))
    );
  });

  bench('zustand - create store with hook', () => {
    renderHook(() => {
      const useZustandStore = createZustand<{ count: number; increment: () => void }>((set, get) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 })
      }));
      return useZustandStore();
    });
  });
});

describe('Core Performance - State Updates', () => {
  const UPDATE_COUNT = 1000;

  // Create stable store creators outside of benchmark runs
  const createStoreReactCounter = () => renderHook(() =>
    useStore<{
      count: number;
      increment: () => void;
    }>((set, get) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 })
    }))
  );

  const createZustandCounter = () => {
    const useZustandStore = createZustand<{
      count: number;
      increment: () => void;
    }>((set, get) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 })
    }));
    return renderHook(() => useZustandStore());
  };

  bench(`@lattice/store-react - ${UPDATE_COUNT} updates`, () => {
    // Setup store once per benchmark run
    const { result } = createStoreReactCounter();

    // BENCHMARK: Measure ONLY the update operations
    act(() => {
      for (let i = 0; i < UPDATE_COUNT; i++) {
        result.current.increment();
      }
    });
  });

  bench(`zustand - ${UPDATE_COUNT} updates`, () => {
    // Setup store once per benchmark run
    const { result } = createZustandCounter();

    // BENCHMARK: Measure ONLY the update operations
    act(() => {
      for (let i = 0; i < UPDATE_COUNT; i++) {
        result.current.increment();
      }
    });
  });
});

describe('Core Performance - Batch Updates', () => {
  const BATCH_SIZE = 100;
  const BATCH_COUNT = 10;

  // Pre-generate batch data outside benchmark runs
  const batchData = Array.from({ length: BATCH_COUNT }, (_, batch) =>
    Array.from({ length: BATCH_SIZE }, (_, i) => i + batch * BATCH_SIZE)
  );

  bench('@lattice/store-react - batch updates', () => {
    // Setup store once per benchmark run
    const { result } = renderHook(() =>
      useStore<{
        items: number[];
        batchUpdate: (items: number[]) => void;
      }>((set) => ({
        items: [],
        batchUpdate: (items) => set({ items })
      }))
    );

    // BENCHMARK: Measure ONLY the batch update operations
    act(() => {
      for (const items of batchData) {
        result.current.batchUpdate(items);
      }
    });
  });

  bench('zustand - batch updates', () => {
    // Setup store once per benchmark run
    const useStore = createZustand<{
      items: number[];
      batchUpdate: (items: number[]) => void;
    }>((set) => ({
      items: [],
      batchUpdate: (items) => set({ items })
    }));
    const { result } = renderHook(() => useStore());

    // BENCHMARK: Measure ONLY the batch update operations
    act(() => {
      for (const items of batchData) {
        result.current.batchUpdate(items);
      }
    });
  });
});

describe('Core Performance - Nested State Updates', () => {
  type NestedState = {
    user: {
      profile: {
        name: string;
        email: string;
        settings: {
          theme: string;
          notifications: boolean;
        };
      };
      posts: Array<{ id: number; title: string; content: string }>;
    };
    updateName: (name: string) => void;
    updateTheme: (theme: string) => void;
    addPost: (post: { title: string; content: string }) => void;
  };

  const initialState = {
    user: {
      profile: {
        name: 'John',
        email: 'john@example.com',
        settings: {
          theme: 'light',
          notifications: true
        }
      },
      posts: []
    }
  };

  bench('@lattice/store-react - nested updates', () => {
    // Setup store once per benchmark run
    const { result } = renderHook(() =>
      useStore<NestedState>((set, get) => ({
        ...initialState,
        updateName: (name) => set({
          user: {
            ...get().user,
            profile: {
              ...get().user.profile,
              name
            }
          }
        }),
        updateTheme: (theme) => set({
          user: {
            ...get().user,
            profile: {
              ...get().user.profile,
              settings: {
                ...get().user.profile.settings,
                theme
              }
            }
          }
        }),
        addPost: (post) => set({
          user: {
            ...get().user,
            posts: [...get().user.posts, { id: get().user.posts.length, ...post }]
          }
        })
      }))
    );

    // BENCHMARK: Measure ONLY the nested update operations
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.updateName(`User ${i}`);
        result.current.updateTheme(i % 2 === 0 ? 'light' : 'dark');
        result.current.addPost({ title: `Post ${i}`, content: `Content ${i}` });
      }
    });
  });

  bench('zustand - nested updates', () => {
    // Setup store once per benchmark run
    const useStore = createZustand<NestedState>((set, get) => ({
      ...initialState,
      updateName: (name) => set({
        user: {
          ...get().user,
          profile: {
            ...get().user.profile,
            name
          }
        }
      }),
      updateTheme: (theme) => set({
        user: {
          ...get().user,
          profile: {
            ...get().user.profile,
            settings: {
              ...get().user.profile.settings,
              theme
            }
          }
        }
      }),
      addPost: (post) => set({
        user: {
          ...get().user,
          posts: [...get().user.posts, { id: get().user.posts.length, ...post }]
        }
      })
    }));
    const { result } = renderHook(() => useStore());

    // BENCHMARK: Measure ONLY the nested update operations
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.updateName(`User ${i}`);
        result.current.updateTheme(i % 2 === 0 ? 'light' : 'dark');
        result.current.addPost({ title: `Post ${i}`, content: `Content ${i}` });
      }
    });
  });
});