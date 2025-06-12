/**
 * @fileoverview React transitions performance benchmarks
 *
 * Tests the performance impact of using React 18 transitions with Lattice hooks
 */

import { describe, bench } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import { useSliceSelector } from '@lattice/runtime';
import type { CreateStore } from '@lattice/core';

const HOOK_COUNT = 100;
const UPDATE_COUNT = 100;

type TestState = {
  count: number;
  items: string[];
  user: { name: string; email: string } | null;
};

describe('React Transitions Performance', () => {
  const createTestComponent = (createStore: CreateStore<TestState>) => {
    const createSlice = createStore({
      count: 0,
      items: [] as string[],
      user: null as { name: string; email: string } | null,
    });

    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      increment: () => set({ count: get().count + 1 }),
      incrementBy: (amount: number) => set({ count: get().count + amount }),
    }));

    const items = createSlice(({ get, set }) => ({
      all: () => get().items,
      add: (item: string) => set({ items: [...get().items, item] }),
      clear: () => set({ items: [] }),
    }));

    const user = createSlice(({ get, set }) => ({
      current: () => get().user,
      login: (userData: { name: string; email: string }) =>
        set({ user: userData }),
      logout: () => set({ user: null }),
    }));

    return { counter, items, user };
  };

  describe('Multiple hooks without transitions', () => {
    bench('zustand adapter - multiple hooks', () => {
      const hooks: any[] = [];

      // Create multiple hooks subscribing to the same store
      for (let i = 0; i < HOOK_COUNT; i++) {
        const store = createZustandAdapter(createTestComponent);
        const { result } = renderHook(
          () =>
            useSliceSelector(
              store,
              (s) => ({
                count: s.counter.value(),
                itemCount: s.items.all().length,
              }),
              undefined,
              false
            ) // No transitions
        );
        hooks.push({ store, result });
      }

      // Trigger updates
      act(() => {
        hooks.forEach(({ store }) => {
          store.counter.increment();
          store.items.add('item');
        });
      });
    });

    bench('redux adapter - multiple hooks', () => {
      const hooks: any[] = [];

      // Create multiple hooks subscribing to the same store
      for (let i = 0; i < HOOK_COUNT; i++) {
        const store = createReduxAdapter(createTestComponent);
        const { result } = renderHook(
          () =>
            useSliceSelector(
              store,
              (s) => ({
                count: s.counter.value(),
                itemCount: s.items.all().length,
              }),
              undefined,
              false
            ) // No transitions
        );
        hooks.push({ store, result });
      }

      // Trigger updates
      act(() => {
        hooks.forEach(({ store }) => {
          store.counter.increment();
          store.items.add('item');
        });
      });
    });

    bench('store-react adapter - multiple hooks', () => {
      const hooks: any[] = [];

      // Create multiple hooks subscribing to the same store
      for (let i = 0; i < HOOK_COUNT; i++) {
        const store = createStoreReactAdapter(createTestComponent);
        const { result } = renderHook(
          () =>
            useSliceSelector(
              store,
              (s) => ({
                count: s.counter.value(),
                itemCount: s.items.all().length,
              }),
              undefined,
              false
            ) // No transitions
        );
        hooks.push({ store, result });
      }

      // Trigger updates
      act(() => {
        hooks.forEach(({ store }) => {
          store.counter.increment();
          store.items.add('item');
        });
      });
    });
  });

  describe('Multiple hooks with transitions', () => {
    bench('zustand adapter - multiple hooks (transitions)', () => {
      const hooks: any[] = [];

      // Create multiple hooks subscribing to the same store
      for (let i = 0; i < HOOK_COUNT; i++) {
        const store = createZustandAdapter(createTestComponent);
        const { result } = renderHook(
          () =>
            useSliceSelector(
              store,
              (s) => ({
                count: s.counter.value(),
                itemCount: s.items.all().length,
              }),
              undefined,
              true
            ) // With transitions
        );
        hooks.push({ store, result });
      }

      // Trigger updates
      act(() => {
        hooks.forEach(({ store }) => {
          store.counter.increment();
          store.items.add('item');
        });
      });
    });

    bench('redux adapter - multiple hooks (transitions)', () => {
      const hooks: any[] = [];

      // Create multiple hooks subscribing to the same store
      for (let i = 0; i < HOOK_COUNT; i++) {
        const store = createReduxAdapter(createTestComponent);
        const { result } = renderHook(
          () =>
            useSliceSelector(
              store,
              (s) => ({
                count: s.counter.value(),
                itemCount: s.items.all().length,
              }),
              undefined,
              true
            ) // With transitions
        );
        hooks.push({ store, result });
      }

      // Trigger updates
      act(() => {
        hooks.forEach(({ store }) => {
          store.counter.increment();
          store.items.add('item');
        });
      });
    });

    bench('store-react adapter - multiple hooks (transitions)', () => {
      const hooks: any[] = [];

      // Create multiple hooks subscribing to the same store
      for (let i = 0; i < HOOK_COUNT; i++) {
        const store = createStoreReactAdapter(createTestComponent);
        const { result } = renderHook(
          () =>
            useSliceSelector(
              store,
              (s) => ({
                count: s.counter.value(),
                itemCount: s.items.all().length,
              }),
              undefined,
              true
            ) // With transitions
        );
        hooks.push({ store, result });
      }

      // Trigger updates
      act(() => {
        hooks.forEach(({ store }) => {
          store.counter.increment();
          store.items.add('item');
        });
      });
    });
  });

  describe('Rapid updates', () => {
    bench('zustand - rapid updates without transitions', () => {
      const store = createZustandAdapter(createTestComponent);
      renderHook(() =>
        useSliceSelector(store, (s) => s.counter.value(), undefined, false)
      );

      act(() => {
        for (let i = 0; i < UPDATE_COUNT; i++) {
          store.counter.increment();
        }
      });
    });

    bench('zustand - rapid updates with transitions', () => {
      const store = createZustandAdapter(createTestComponent);
      renderHook(() =>
        useSliceSelector(store, (s) => s.counter.value(), undefined, true)
      );

      act(() => {
        for (let i = 0; i < UPDATE_COUNT; i++) {
          store.counter.increment();
        }
      });
    });

    bench('store-react - rapid updates without transitions', () => {
      const store = createStoreReactAdapter(createTestComponent);
      renderHook(() =>
        useSliceSelector(store, (s) => s.counter.value(), undefined, false)
      );

      act(() => {
        for (let i = 0; i < UPDATE_COUNT; i++) {
          store.counter.increment();
        }
      });
    });

    bench('store-react - rapid updates with transitions', () => {
      const store = createStoreReactAdapter(createTestComponent);
      renderHook(() =>
        useSliceSelector(store, (s) => s.counter.value(), undefined, true)
      );

      act(() => {
        for (let i = 0; i < UPDATE_COUNT; i++) {
          store.counter.increment();
        }
      });
    });
  });
});
