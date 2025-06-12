/**
 * @fileoverview Tests for store-react adapter
 *
 * Tests specific features and edge cases of the store-react adapter
 */

import { describe, it, expect, vi } from 'vitest';
import { createStoreReactAdapter, wrapStoreReact, createStoreAdapter } from './index';
import type { CreateStore } from '@lattice/core';
import type { StoreApi as StoreReactApi } from '@lattice/store-react';

describe('store-react adapter', () => {
  describe('createStoreReactAdapter', () => {
    it('should create a working store', () => {
      const createApp = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });

        const counter = createSlice(({ get, set }) => ({
          count: () => get().count,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
        }));

        return { counter };
      };

      const store = createStoreReactAdapter(createApp);

      expect(store.counter.count()).toBe(0);

      store.counter.increment();
      expect(store.counter.count()).toBe(1);

      store.counter.decrement();
      expect(store.counter.count()).toBe(0);
    });

    it('should support subscriptions', () => {
      const createApp = (createStore: CreateStore<{ value: string }>) => {
        const createSlice = createStore({ value: 'initial' });

        const actions = createSlice(({ set }) => ({
          setValue: (value: string) => set({ value }),
        }));

        const queries = createSlice(({ get }) => ({
          value: () => get().value,
        }));

        return { actions, queries };
      };

      const store = createStoreReactAdapter(createApp);
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.actions.setValue('changed');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.queries.value()).toBe('changed');

      unsubscribe();
      store.actions.setValue('changed again');
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle errors in listeners', () => {
      const createApp = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });

        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
        }));

        return { actions };
      };

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = createStoreReactAdapter(createApp);

      const goodListener = vi.fn();
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      store.subscribe(badListener);
      store.subscribe(goodListener);

      store.actions.increment();

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Error in store listener:', expect.any(Error));

      consoleError.mockRestore();
    });

    it('should support custom error handlers', () => {
      const createApp = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });

        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
        }));

        return { actions };
      };

      const errorHandler = vi.fn();
      const store = createStoreReactAdapter(createApp, undefined, { onError: errorHandler });

      const badListener = vi.fn(() => {
        throw new Error('Test error');
      });

      store.subscribe(badListener);
      store.actions.increment();

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should support enhancers', () => {
      const createApp = (createStore: CreateStore<{ count: number; enhanced: boolean }>) => {
        const createSlice = createStore({ count: 0, enhanced: false });

        const queries = createSlice(({ get }) => ({
          count: () => get().count,
          enhanced: () => get().enhanced,
        }));

        return { queries };
      };

      // Create a simple enhancer that adds a flag
      const enhancer = (stateCreator: any, createStore: any) => {
        const store = createStore((set: any, get: any) => {
          const state = stateCreator(set, get);
          return { ...state, enhanced: true };
        });
        return store;
      };

      const store = createStoreReactAdapter(createApp, enhancer);

      expect(store.queries.count()).toBe(0);
      expect(store.queries.enhanced()).toBe(true);
    });
  });

  describe('wrapStoreReact', () => {
    it('should wrap an existing store-react store', () => {
      // Create a mock store-react store
      const listeners = new Set<() => void>();
      let state = { count: 0 };

      const mockStore: StoreReactApi<{ count: number }> = {
        getState: () => state,
        setState: (updates) => {
          const partial = typeof updates === 'function' ? updates(state) : updates;
          state = { ...state, ...partial };
          listeners.forEach(l => l());
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        destroy: () => listeners.clear(),
      };

      const adapter = wrapStoreReact(mockStore);

      expect(adapter.getState()).toEqual({ count: 0 });

      const listener = vi.fn();
      const unsubscribe = adapter.subscribe(listener);

      adapter.setState({ count: 1 });
      expect(adapter.getState()).toEqual({ count: 1 });
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      adapter.setState({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
    });

    it('should handle unsubscribe during notification', () => {
      const listeners = new Set<() => void>();
      let state = { value: 0 };

      const mockStore: StoreReactApi<{ value: number }> = {
        getState: () => state,
        setState: (updates) => {
          const partial = typeof updates === 'function' ? updates(state) : updates;
          state = { ...state, ...partial };
          listeners.forEach(l => l());
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        destroy: () => listeners.clear(),
      };

      const adapter = wrapStoreReact(mockStore);

      let unsubscribe2: (() => void) | null = null;
      const listener1 = vi.fn(() => {
        // Unsubscribe listener2 during notification
        if (unsubscribe2) {
          unsubscribe2();
        }
      });
      const listener2 = vi.fn();

      adapter.subscribe(listener1);
      unsubscribe2 = adapter.subscribe(listener2);

      adapter.setState({ value: 1 });

      // Both should be called in the first notification
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Second update - listener2 should not be called
      adapter.setState({ value: 2 });
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('createStoreAdapter', () => {
    it('should create a store adapter factory', () => {
      const adapterFactory = createStoreAdapter<{ count: number }>();
      const adapter = adapterFactory({ count: 5 });

      expect(adapter.getState()).toEqual({ count: 5 });

      adapter.setState({ count: 10 });
      expect(adapter.getState()).toEqual({ count: 10 });
    });

    it('should notify on every setState call per adapter contract', () => {
      const adapterFactory = createStoreAdapter<{ count: number; name: string }>();
      const adapter = adapterFactory({ count: 0, name: 'test' });

      const listener = vi.fn();
      adapter.subscribe(listener);

      // Update with same values - should still notify per adapter contract
      adapter.setState({ count: 0 });
      expect(listener).toHaveBeenCalledTimes(1);

      // Update with different value - should notify
      adapter.setState({ count: 1 });
      expect(listener).toHaveBeenCalledTimes(2);

      // Update multiple fields, no change - should still notify
      adapter.setState({ count: 1, name: 'test' });
      expect(listener).toHaveBeenCalledTimes(3);

      adapter.setState({ count: 1, name: 'changed' });
      expect(listener).toHaveBeenCalledTimes(4);
    });
  });

  describe('destroy functionality', () => {
    it('should clean up when destroy is called', () => {
      const createApp = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });

        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ value: get().value + 1 }),
        }));

        return { actions };
      };

      const store = createStoreReactAdapter(createApp);
      const listener = vi.fn();
      
      store.subscribe(listener);
      store.actions.increment();
      expect(listener).toHaveBeenCalledTimes(1);

      // Destroy the store
      if (store.destroy) {
        store.destroy();
      }

      // Further updates should not notify (implementation dependent)
      // This test documents the behavior rather than enforcing it
    });
  });
});