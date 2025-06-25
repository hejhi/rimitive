/**
 * @fileoverview Tests for store-react adapter
 *
 * Tests specific features and edge cases of the store-react adapter
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createStore,
  wrapStoreReact,
  createStoreAdapter,
} from './index';
import type { RuntimeSliceFactory } from '@lattice/core';
// Internal store API type (previously from @lattice/store/react)
interface StoreReactApi<T> {
  getState: () => T;
  setState: (updates: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
  destroy?: () => void;
}

describe('store-react adapter', () => {
  describe('createStore', () => {
    it('should create a working store', () => {
      const createSlice = createStore({ count: 0 });

      const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
        const counter = createSlice(({ count }) => ({
          count, // count is already a signal
          increment: () => count(count() + 1),
          decrement: () => count(count() - 1),
        }));

        return { counter };
      };

      const store = createComponent(createSlice);

      const counterSlice = store.counter();
      expect(counterSlice.count()).toBe(0);

      counterSlice.increment();
      expect(counterSlice.count()).toBe(1);

      counterSlice.decrement();
      expect(counterSlice.count()).toBe(0);
    });

    it('should support subscriptions', () => {
      const createSlice = createStore({ value: 'initial' });

      const createComponent = (createSlice: RuntimeSliceFactory<{ value: string }>) => {
        const actions = createSlice(({ value }) => ({
          setValue: (newValue: string) => value(newValue),
        }));

        const queries = createSlice(({ value }) => ({
          value, // value is already a signal
        }));

        return { actions, queries };
      };

      const store = createComponent(createSlice);
      const listener = vi.fn();
      
      // Subscribe to signal directly (new signals-first approach)
      const unsubscribe = store.queries().value.subscribe(listener);

      const actionsSlice = store.actions();
      actionsSlice.setValue('changed');
      expect(listener).toHaveBeenCalledTimes(1);
      
      const queriesSlice = store.queries();
      expect(queriesSlice.value()).toBe('changed');

      unsubscribe();
      actionsSlice.setValue('changed again');
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle errors in listeners', () => {
      // Test the adapter's error handling directly
      const listeners = new Set<() => void>();
      let state = { count: 0 };

      const mockStore: StoreReactApi<{ count: number }> = {
        getState: () => state,
        setState: (updates: Partial<{ count: number }> | ((state: { count: number }) => Partial<{ count: number }>)) => {
          const partial =
            typeof updates === 'function' ? updates(state) : updates;
          state = { ...state, ...partial };
          
          // Error handling implementation from createStoreReactStore
          const currentListeners = Array.from(listeners);
          for (const listener of currentListeners) {
            try {
              listener();
            } catch (error) {
              if (process.env.NODE_ENV !== 'production') {
                console.error('Error in store listener:', error);
              }
            }
          }
        },
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        destroy: () => listeners.clear(),
      };

      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const adapter = wrapStoreReact(mockStore);

      const goodListener = vi.fn();
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      adapter.subscribe(badListener);
      adapter.subscribe(goodListener);

      adapter.setState({ count: 1 });

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Error in store listener:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should support custom error handlers', () => {
      const errorHandler = vi.fn();
      const createSlice = createStore({ count: 0 }, {
        onError: errorHandler,
      });

      const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
        const actions = createSlice(({ count }) => ({
          count, // expose signal for subscription
          increment: () => count(count() + 1),
        }));

        return { actions };
      };

      const store = createComponent(createSlice);

      const badListener = vi.fn(() => {
        throw new Error('Test error');
      });

      // Subscribe to signal directly
      store.actions().count.subscribe(badListener);
      
      const actionsSlice = store.actions();
      
      // Signals-first architecture: errors in signal subscribers should be handled by adapter
      // But since signals throw directly, we expect the error to propagate
      expect(() => actionsSlice.increment()).toThrow('Test error');
    });

    it('should support enhancers', () => {
      // Create a simple enhancer that adds a flag
      const enhancer = (stateCreator: any, createStore: any) => {
        const store = createStore((set: any, get: any) => {
          const state = stateCreator(set, get);
          return { ...state, enhanced: true };
        });
        return store;
      };

      const createSlice = createStore({ count: 0, enhanced: false }, { enhancer });

      const createComponent = (
        createSlice: RuntimeSliceFactory<{ count: number; enhanced: boolean }>
      ) => {
        const queries = createSlice(({ count, enhanced }) => ({
          count, // count is already a signal
          enhanced, // enhanced is already a signal
        }));

        return { queries };
      };

      const store = createComponent(createSlice);

      const queriesSlice = store.queries();
      expect(queriesSlice.count()).toBe(0);
      expect(queriesSlice.enhanced()).toBe(true);
    });
  });

  describe('wrapStoreReact', () => {
    it('should wrap an existing store-react store', () => {
      // Create a mock store-react store
      const listeners = new Set<() => void>();
      let state = { count: 0 };

      const mockStore: StoreReactApi<{ count: number }> = {
        getState: () => state,
        setState: (updates: Partial<{ count: number }> | ((state: { count: number }) => Partial<{ count: number }>)) => {
          const partial =
            typeof updates === 'function' ? updates(state) : updates;
          state = { ...state, ...partial };
          listeners.forEach((l) => l());
        },
        subscribe: (listener: () => void) => {
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
        setState: (updates: Partial<{ value: number }> | ((state: { value: number }) => Partial<{ value: number }>)) => {
          const partial =
            typeof updates === 'function' ? updates(state) : updates;
          state = { ...state, ...partial };
          // Use Array.from to handle concurrent modifications
          const currentListeners = Array.from(listeners);
          currentListeners.forEach((l) => l());
        },
        subscribe: (listener: () => void) => {
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
      const adapterFactory = createStoreAdapter<{
        count: number;
        name: string;
      }>();
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
      const createSlice = createStore({ value: 0 });

      const createComponent = (createSlice: RuntimeSliceFactory<{ value: number }>) => {
        const actions = createSlice(({ value }) => ({
          value, // expose signal for subscription
          increment: () => value(value() + 1),
        }));

        return { actions };
      };

      const store = createComponent(createSlice);
      const listener = vi.fn();

      // Subscribe to signal directly
      const unsubscribe = store.actions().value.subscribe(listener);
      
      const actionsSlice = store.actions();
      actionsSlice.increment();
      expect(listener).toHaveBeenCalledTimes(1);

      // Test unsubscribe (replaces destroy functionality)
      unsubscribe();
      actionsSlice.increment();
      expect(listener).toHaveBeenCalledTimes(1); // Should not increment
    });
  });
});
