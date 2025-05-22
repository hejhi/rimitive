/**
 * Comprehensive tests for the production-quality Zustand adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ZustandStateAdapter,
  createZustandAdapterSync,
  type ZustandStoreCreator,
  type ZustandStore
} from './index';
import type { StateStore } from '@lattice/core/shared/state-adapter';

// Mock Zustand store for testing
function createMockZustandStore<T>(initialState: T): ZustandStore<T> {
  let state = initialState;
  const listeners = new Set<(state: T, prevState: T) => void>();

  return {
    getState: () => state,
    setState: (partial, replace = false) => {
      const prevState = state;
      if (typeof partial === 'function') {
        const result = partial(state);
        state = replace ? result : { ...state, ...result };
      } else {
        state = replace ? partial : { ...state, ...partial };
      }
      listeners.forEach(listener => listener(state, prevState));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => listeners.clear(),
  };
}

describe('ZustandStateAdapter', () => {
  let mockCreate: ZustandStoreCreator;

  beforeEach(() => {
    mockCreate = vi.fn((createFn) => {
      const setMock = vi.fn();
      const getMock = vi.fn();
      const initialState = createFn(setMock, getMock);
      return createMockZustandStore(initialState);
    });
  });

  describe('constructor', () => {
    it('should require storeCreator in config', () => {
      expect(() => {
        new ZustandStateAdapter({});
      }).toThrow('ZustandStateAdapter requires a storeCreator');
    });

    it('should accept valid config with storeCreator', () => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
        devtools: true,
        name: 'Test Store',
      });
      
      expect(adapter).toBeInstanceOf(ZustandStateAdapter);
    });
  });

  describe('createStore', () => {
    let adapter: ZustandStateAdapter<{ count: number }>;

    beforeEach(() => {
      adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });
    });

    it('should create a working state store with direct state', () => {
      const store = adapter.createStore({ count: 0 });

      expect(store.get()).toEqual({ count: 0 });
      
      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });
    });

    it('should create a working state store with factory function', () => {
      const stateFactory = ({ set, get }: { set: any; get: any }) => ({
        count: 0,
        increment: () => set((state: any) => ({ count: state.count + 1 })),
      });

      const store = adapter.createStore(stateFactory as any);
      
      // Verify the factory was called with set/get
      expect(mockCreate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should support subscriptions', () => {
      const store = adapter.createStore({ count: 0 });
      const listener = vi.fn();
      
      const unsubscribe = store.subscribe!(listener);

      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledWith({ count: 1 });

      unsubscribe();
      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support functional updates', () => {
      const store = adapter.createStore({ count: 0 });

      store.set((state) => ({ count: state.count + 1 }));
      expect(store.get()).toEqual({ count: 1 });
    });

    it('should support replace mode', () => {
      const store = adapter.createStore({ count: 0, name: 'test' });

      store.set({ count: 1 }, true);
      expect(store.get()).toEqual({ count: 1 });
    });

    it('should support destroy', () => {
      const store = adapter.createStore({ count: 0 });
      
      expect(() => store.destroy!()).not.toThrow();
    });
  });

  describe('createStoreWithMiddleware', () => {
    let adapter: ZustandStateAdapter<{ count: number }>;

    beforeEach(() => {
      adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });
    });

    it('should apply middleware to state creation', () => {
      const middleware1 = vi.fn((config) => config);
      const middleware2 = vi.fn((config) => config);

      adapter.createStoreWithMiddleware(
        { count: 0 },
        [middleware1, middleware2]
      );

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
    });

    it('should work with factory functions and middleware', () => {
      const stateFactory = ({ set, get }: any) => ({
        count: 0,
        increment: () => set((state: any) => ({ count: state.count + 1 })),
      });

      const middleware = vi.fn((config) => config);

      const store = adapter.createStoreWithMiddleware(
        stateFactory as any,
        [middleware]
      );

      expect(middleware).toHaveBeenCalled();
      expect(store).toBeDefined();
    });
  });

  describe('StateStore interface compliance', () => {
    let store: StateStore<{ count: number }>;

    beforeEach(() => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });
      store = adapter.createStore({ count: 0 });
    });

    it('should implement StateStore interface', () => {
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.destroy).toBe('function');
    });

    it('should maintain type safety for get/set operations', () => {
      // These should compile without type errors
      const state = store.get();
      expect(state.count).toBe(0);

      store.set({ count: 1 });
      expect(store.get().count).toBe(1);

      store.set((state) => ({ count: state.count + 1 }));
      expect(store.get().count).toBe(2);
    });
  });

  describe('createZustandAdapterSync', () => {
    it('should create adapter with provided store creator', () => {
      const adapter = createZustandAdapterSync(mockCreate, {
        devtools: false,
        name: 'Sync Test',
      });

      expect(adapter).toBeInstanceOf(ZustandStateAdapter);
      
      const store = adapter.createStore({ count: 0 });
      expect(store.get()).toEqual({ count: 0 });
    });

    it('should work with empty config', () => {
      const adapter = createZustandAdapterSync(mockCreate);
      
      expect(adapter).toBeInstanceOf(ZustandStateAdapter);
    });
  });

  describe('error handling', () => {
    it('should handle middleware errors gracefully', () => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });

      const faultyMiddleware = () => {
        throw new Error('Middleware error');
      };

      expect(() => {
        adapter.createStoreWithMiddleware({ count: 0 }, [faultyMiddleware]);
      }).toThrow('Middleware error');
    });

    it('should handle state factory errors', () => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });

      const faultyFactory = () => {
        throw new Error('Factory error');
      };

      expect(() => {
        adapter.createStore(faultyFactory as any);
      }).toThrow();
    });
  });

  describe('performance characteristics', () => {
    it('should handle multiple rapid state updates', () => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });
      const store = adapter.createStore({ count: 0 });
      
      const listener = vi.fn();
      store.subscribe!(listener);

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        store.set({ count: i });
      }

      expect(store.get().count).toBe(99);
      expect(listener).toHaveBeenCalledTimes(100);
    });

    it('should handle large state objects', () => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockCreate,
      });

      const largeState = {
        items: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })),
        metadata: { count: 1000, version: 1 },
      };

      const store = adapter.createStore(largeState);
      
      expect(store.get().items).toHaveLength(1000);
      expect(store.get().metadata.count).toBe(1000);
    });
  });
});