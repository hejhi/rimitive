/**
 * @fileoverview Head-to-head library comparisons
 * 
 * Direct performance comparisons between similar libraries
 */

import { describe, bench } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore as useStoreReact } from '@lattice/store-react';
import { create as createZustand } from 'zustand';
import { createStore as createZustandVanilla } from 'zustand/vanilla';

const ITERATIONS = 1000;
const HOOK_COUNT = 100;

describe('Head-to-Head Comparisons', () => {
  describe('React: store-react vs zustand', () => {
    bench('store-react - hook creation and updates', () => {
      const { result } = renderHook(() => 
        useStoreReact((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 })
        }))
      );

      act(() => {
        for (let i = 0; i < ITERATIONS; i++) {
          result.current.increment();
        }
      });

      return result.current.count;
    });

    bench('zustand - hook creation and updates', () => {
      const useStore = createZustand<{
        count: number;
        increment: () => void;
        decrement: () => void;
      }>((set, get) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 })
      }));

      const { result } = renderHook(() => useStore());

      act(() => {
        for (let i = 0; i < ITERATIONS; i++) {
          result.current.increment();
        }
      });

      return result.current.count;
    });

    bench('store-react - multiple hooks same store', () => {
      const hooks = [];
      
      for (let i = 0; i < HOOK_COUNT; i++) {
        const { result } = renderHook(() => 
          useStoreReact((set, get) => ({
            value: i,
            update: (v: number) => set({ value: v })
          }))
        );
        hooks.push(result);
      }

      act(() => {
        hooks.forEach((hook, idx) => {
          hook.current.update(idx * 2);
        });
      });

      return hooks.length;
    });

    bench('zustand - multiple hooks same store', () => {
      const hooks = [];
      
      for (let i = 0; i < HOOK_COUNT; i++) {
        const useStore = createZustand<{
          value: number;
          update: (v: number) => void;
        }>((set) => ({
          value: i,
          update: (v) => set({ value: v })
        }));
        
        const { result } = renderHook(() => useStore());
        hooks.push(result);
      }

      act(() => {
        hooks.forEach((hook, idx) => {
          hook.current.update(idx * 2);
        });
      });

      return hooks.length;
    });

    bench('store-react - subscription performance', () => {
      const { result } = renderHook(() => 
        useStoreReact((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 })
        }))
      );

      const listeners: (() => void)[] = [];
      
      // Add many subscriptions
      for (let i = 0; i < 50; i++) {
        listeners.push(result.current.subscribe(() => {}));
      }

      // Trigger updates
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.increment();
        }
      });

      // Cleanup
      listeners.forEach(unsub => unsub());
      
      return result.current.count;
    });

    bench('zustand - subscription performance', () => {
      const store = createZustandVanilla<{
        count: number;
      }>(() => ({ count: 0 }));

      const listeners: (() => void)[] = [];
      
      // Add many subscriptions
      for (let i = 0; i < 50; i++) {
        listeners.push(store.subscribe(() => {}));
      }

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        store.setState({ count: i });
      }

      // Cleanup
      listeners.forEach(unsub => unsub());
      
      return store.getState().count;
    });
  });

  describe('Vanilla: store-react vs zustand (no React)', () => {
    bench('store-react vanilla - state updates', () => {
      // Create a store without React using the internal API
      const listeners = new Set<() => void>();
      let state = { count: 0 };
      
      const store = {
        getState: () => state,
        setState: (updates: any) => {
          state = { ...state, ...updates };
          listeners.forEach(l => l());
        },
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      };

      for (let i = 0; i < ITERATIONS; i++) {
        store.setState({ count: i });
      }

      return store.getState().count;
    });

    bench('zustand vanilla - state updates', () => {
      const store = createZustandVanilla<{ count: number }>(() => ({ count: 0 }));

      for (let i = 0; i < ITERATIONS; i++) {
        store.setState({ count: i });
      }

      return store.getState().count;
    });
  });
});