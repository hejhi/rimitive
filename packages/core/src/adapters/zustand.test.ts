/**
 * Comprehensive tests for the Zustand State Adapter
 * 
 * These tests ensure full type safety, proper middleware integration,
 * and production-quality behavior without any shortcuts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ZustandStateAdapter, 
  createZustandAdapterSync,
  type ZustandStore,
  type ZustandStoreCreator,
  type ZustandMiddleware
} from './zustand';
import type { SetState, GetState } from '../shared/types';

/**
 * Mock Zustand store implementation for testing
 */
function createMockZustandStore<T>(initialStateCreator: (set: SetState<T>, get: GetState<T>) => T): ZustandStore<T> {
  const listeners = new Set<(state: T, prevState: T) => void>();
  
  let state: T;
  
  const set: SetState<T> = (partial, replace = false) => {
    const prevState = state;
    
    if (typeof partial === 'function') {
      const updater = partial as (state: T) => T | Partial<T>;
      const result = updater(state);
      state = replace ? (result as T) : { ...state, ...result } as T;
    } else {
      state = replace ? (partial as T) : { ...state, ...partial } as T;
    }
    
    // Notify listeners
    listeners.forEach(listener => {
      try {
        listener(state, prevState);
      } catch (error) {
        console.error('Error in listener:', error);
      }
    });
  };
  
  const get: GetState<T> = () => state;
  
  // Initialize state
  state = initialStateCreator(set, get);
  
  return {
    getState: () => state,
    setState: set,
    subscribe: (listener: (state: T, prevState: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      listeners.clear();
    }
  };
}

/**
 * Mock Zustand store creator
 */
const mockZustandCreate: ZustandStoreCreator = <T>(
  stateCreator: (set: SetState<T>, get: GetState<T>) => T
) => {
  return createMockZustandStore(stateCreator);
};

describe('ZustandStateAdapter', () => {
  describe('Constructor and Configuration', () => {
    it('should throw error when no storeCreator is provided', () => {
      expect(() => {
        new ZustandStateAdapter({});
      }).toThrow('ZustandStateAdapter requires a storeCreator');
    });

    it('should accept valid configuration', () => {
      expect(() => {
        new ZustandStateAdapter({
          storeCreator: mockZustandCreate,
          devtools: true,
          name: 'Test Store'
        });
      }).not.toThrow();
    });
  });

  describe('Basic Store Operations', () => {
    let adapter: ZustandStateAdapter<{ count: number }>;

    beforeEach(() => {
      adapter = new ZustandStateAdapter({
        storeCreator: mockZustandCreate,
      });
    });

    it('should create a store with direct state', () => {
      const store = adapter.createStore({ count: 0 });

      expect(store.get()).toEqual({ count: 0 });
    });

    it('should create a store with factory function', () => {
      const stateFactory = ({ set, get }: { set: SetState<{ count: number }>; get: GetState<{ count: number }> }) => ({
        count: 5,
        increment: () => {
          const current = get();
          set({ count: current.count + 1 });
        }
      });

      const store = adapter.createStore(stateFactory);
      const state = store.get();

      expect(state.count).toBe(5);
      expect(typeof state.increment).toBe('function');
    });

    it('should support state updates', () => {
      const store = adapter.createStore({ count: 0 });

      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });

      store.set((state) => ({ count: state.count + 1 }));
      expect(store.get()).toEqual({ count: 2 });
    });

    it('should support subscriptions', () => {
      const store = adapter.createStore({ count: 0 });
      const listener = vi.fn();

      const unsubscribe = store.subscribe!(listener);

      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledWith({ count: 1 });

      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledWith({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      store.set({ count: 3 });
      expect(listener).toHaveBeenCalledTimes(2); // Should not be called after unsubscribe
    });

    it('should support store destruction', () => {
      const store = adapter.createStore({ count: 0 });
      const listener = vi.fn();

      store.subscribe!(listener);
      expect(() => store.destroy!()).not.toThrow();

      // After destruction, listeners should not be called
      store.set({ count: 1 });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Middleware Integration', () => {
    let adapter: ZustandStateAdapter<{ count: number }>;

    beforeEach(() => {
      adapter = new ZustandStateAdapter({
        storeCreator: mockZustandCreate,
      });
    });

    it('should apply middleware correctly', () => {
      const loggerMiddleware: ZustandMiddleware<{ count: number }> = (config) => (set, get) => {
        const state = config(set, get);
        console.log('State initialized with middleware:', state);
        return state;
      };

      const store = adapter.createStoreWithMiddleware({ count: 0 }, [loggerMiddleware]);
      expect(store.get()).toEqual({ count: 0 });
    });

    it('should apply multiple middleware in correct order', () => {
      const calls: string[] = [];

      const middleware1: ZustandMiddleware<{ count: number }> = (config) => (set, get) => {
        calls.push('middleware1');
        return config(set, get);
      };

      const middleware2: ZustandMiddleware<{ count: number }> = (config) => (set, get) => {
        calls.push('middleware2');
        return config(set, get);
      };

      adapter.createStoreWithMiddleware({ count: 0 }, [middleware1, middleware2]);
      
      // Middleware is applied right-to-left (innermost first, like function composition)
      expect(calls).toEqual(['middleware2', 'middleware1']);
    });

    it('should work with factory functions and middleware', () => {
      const enhancerMiddleware: ZustandMiddleware<{ count: number; increment: () => void }> = 
        (config) => (set, get) => {
          const state = config(set, get);
          return {
            ...state,
            enhanced: true
          } as { count: number; increment: () => void };
        };

      const stateFactory = ({ set, get }: { 
        set: SetState<{ count: number; increment: () => void }>; 
        get: GetState<{ count: number; increment: () => void }> 
      }) => ({
        count: 0,
        increment: () => {
          const current = get();
          set({ count: current.count + 1 });
        }
      });

      const store = adapter.createStoreWithMiddleware(stateFactory, [enhancerMiddleware]);
      const state = store.get();

      expect(state.count).toBe(0);
      expect(typeof state.increment).toBe('function');
      expect((state as any).enhanced).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety across all operations', () => {
      const adapter = new ZustandStateAdapter<{ count: number; name: string }>({
        storeCreator: mockZustandCreate,
      });

      const store = adapter.createStore({ count: 0, name: 'test' });

      // These should compile without type errors
      const state = store.get();
      expect(state.count).toBe(0);
      expect(state.name).toBe('test');

      store.set({ count: 1 });
      store.set({ name: 'updated' });
      store.set({ count: 2, name: 'both' });

      store.set((prevState) => ({
        count: prevState.count + 1,
        name: prevState.name.toUpperCase()
      }));

      expect(store.get().count).toBe(3);
      expect(store.get().name).toBe('BOTH');
    });
  });

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', () => {
      const adapter = new ZustandStateAdapter({
        storeCreator: mockZustandCreate,
      });

      const store = adapter.createStore({ count: 0 });
      
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      store.subscribe!(errorListener);
      store.subscribe!(goodListener);

      // Should not throw even if a listener throws
      expect(() => store.set({ count: 1 })).not.toThrow();
      
      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });
});

describe('Factory Functions', () => {
  describe('createZustandAdapterSync', () => {
    it('should create adapter with provided store creator', () => {
      const adapter = createZustandAdapterSync(mockZustandCreate, {
        devtools: true,
        name: 'Sync Test'
      });

      const store = adapter.createStore({ value: 'test' });
      expect(store.get()).toEqual({ value: 'test' });

      store.set({ value: 'updated' });
      expect(store.get()).toEqual({ value: 'updated' });
    });

    it('should work without optional config', () => {
      const adapter = createZustandAdapterSync(mockZustandCreate);
      const store = adapter.createStore({ value: 42 });
      
      expect(store.get()).toEqual({ value: 42 });
    });
  });
});

// Integration tests would go here for async factory functions
// These would require actual Zustand to be installed and imported
describe('Integration Tests', () => {
  it.todo('should integrate with real Zustand store');
  it.todo('should integrate with Zustand devtools middleware');
  it.todo('should integrate with Zustand immer middleware');
  it.todo('should handle async factory functions correctly');
});