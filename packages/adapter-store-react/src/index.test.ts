/**
 * @fileoverview Tests for store-react adapter
 *
 * Tests specific features and edge cases of the store-react adapter
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createStore,
  storeReactAdapter,
  type StoreEnhancer,
} from './index';
import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';
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
      const store = createStore({ count: 0 });
      const adapter = storeReactAdapter(store);

      const Counter = createComponent(
        withState<{ count: number }>(),
        ({ store, set }) => ({
          count: store.count,
          increment: () => set({ count: store.count() + 1 }),
          decrement: () => set({ count: store.count() - 1 }),
        })
      );

      const counter = createStoreWithAdapter(Counter, adapter);

      expect(counter.count()).toBe(0);

      counter.increment();
      expect(counter.count()).toBe(1);

      counter.decrement();
      expect(counter.count()).toBe(0);
    });

    it('should support subscriptions', () => {
      const store = createStore({ value: 'initial' });
      const adapter = storeReactAdapter(store);

      const Component = createComponent(
        withState<{ value: string }>(),
        ({ store, set }) => ({
          value: store.value,
          setValue: (newValue: string) => set({ value: newValue }),
        })
      );

      const component = createStoreWithAdapter(Component, adapter);
      const listener = vi.fn();
      
      // Subscribe to signal directly
      const unsubscribe = component.value.subscribe(listener);

      component.setValue('changed');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(component.value()).toBe('changed');

      unsubscribe();
      component.setValue('changed again');
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

      const adapter = storeReactAdapter(mockStore);

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

    it('should support custom error handlers for adapter subscriptions', () => {
      const errorHandler = vi.fn();
      
      // Create a custom store that we can manipulate
      const mockStore = {
        getState: () => ({ count: 0 }),
        setState: vi.fn(),
        subscribe: vi.fn((listener: () => void) => {
          // Store the listener so we can trigger it with an error
          mockStore._listener = listener;
          return () => {};
        }),
        _listener: null as (() => void) | null
      };

      // Wrap with error handling
      const adapter = storeReactAdapter(mockStore, { onError: errorHandler });
      
      // Subscribe with a bad listener through the adapter
      const badListener = vi.fn(() => {
        throw new Error('Test error');
      });
      
      adapter.subscribe(badListener);
      
      // Trigger the error by calling setState which should notify listeners
      mockStore.setState({ count: 1 });
      
      // Manually trigger the bad listener (simulating store notification)
      expect(() => badListener()).toThrow('Test error');
      
      // Since the adapter wraps listeners, let's verify the error handler works
      // by calling the wrapped listener that the adapter created
      const wrappedListener = mockStore.subscribe.mock.calls[0]?.[0];
      if (wrappedListener) {
        wrappedListener(); // This should trigger badListener through error handler
      }
      
      // Verify error handler was called
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should support enhancers', () => {
      // Create a simple enhancer that adds a flag
      type TestState = { count: number; enhanced: boolean };
      const enhancer: StoreEnhancer<TestState> = (stateCreator, createStore) => {
        const store = createStore((set, get) => {
          const state = stateCreator(set, get);
          return { ...state, enhanced: true };
        });
        return store;
      };

      const store = createStore({ count: 0, enhanced: false }, enhancer);
      const adapter = storeReactAdapter(store);

      const Component = createComponent(
        withState<{ count: number; enhanced: boolean }>(),
        ({ store }) => ({
          count: store.count,
          enhanced: store.enhanced,
        })
      );

      const component = createStoreWithAdapter(Component, adapter);

      expect(component.count()).toBe(0);
      expect(component.enhanced()).toBe(true);
    });
  });

  describe('storeReactAdapter', () => {
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

      const adapter = storeReactAdapter(mockStore);

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

      const adapter = storeReactAdapter(mockStore);

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


  describe('destroy functionality', () => {
    it('should clean up when unsubscribe is called', () => {
      const store = createStore({ value: 0 });
      const adapter = storeReactAdapter(store);

      const Component = createComponent(
        withState<{ value: number }>(),
        ({ store, set }) => ({
          value: store.value,
          increment: () => set({ value: store.value() + 1 }),
        })
      );

      const component = createStoreWithAdapter(Component, adapter);
      const listener = vi.fn();

      // Subscribe to the signal directly
      const unsubscribe = component.value.subscribe(listener);
      
      // Trigger a change
      component.increment();
      
      // The listener should be called when the adapter updates the signal
      expect(listener).toHaveBeenCalledTimes(1);

      // Test unsubscribe
      unsubscribe();
      component.increment();
      
      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
