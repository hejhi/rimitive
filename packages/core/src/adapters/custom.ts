/**
 * Minimal Custom State Adapter
 * 
 * This is a reference implementation of the StateAdapter interface
 * that provides basic in-memory state management without external dependencies.
 * It serves as both a minimal working adapter and a template for building
 * other state adapters.
 */

import type { StateAdapter, StateStore } from '../shared/state-adapter';
import type { SetState, GetState } from '../shared/types';

/**
 * Configuration options for the custom adapter
 */
export interface CustomAdapterConfig {
  /**
   * Enable development mode features like state logging
   */
  devMode?: boolean;
  
  /**
   * Custom equality function for state updates
   * Defaults to Object.is for primitive values and shallow comparison for objects
   */
  equalityFn?: <T>(a: T, b: T) => boolean;
}

/**
 * Internal state store implementation
 */
class CustomStateStore<T> implements StateStore<T> {
  private state: T;
  private listeners: Set<(state: T) => void> = new Set();
  private config: CustomAdapterConfig;

  constructor(initialState: T, config: CustomAdapterConfig = {}) {
    this.state = initialState;
    this.config = config;
    
    if (config.devMode) {
      console.log('CustomStateStore: Initial state', initialState);
    }
  }

  get: GetState<T> = () => {
    return this.state;
  };

  set: SetState<T> = (partial, replace) => {
    const prevState = this.state;
    
    if (typeof partial === 'function') {
      // Handle function updater
      const updater = partial as (state: T) => T | Partial<T>;
      const result = updater(this.state);
      this.state = replace ? (result as T) : { ...this.state, ...result };
    } else {
      // Handle direct value or partial update
      this.state = replace ? (partial as T) : { ...this.state, ...partial };
    }

    // Only notify if state actually changed
    if (!this.isEqual(prevState, this.state)) {
      if (this.config.devMode) {
        console.log('CustomStateStore: State updated', {
          prev: prevState,
          next: this.state,
        });
      }
      
      this.notifyListeners();
    }
  };

  subscribe = (listener: (state: T) => void): (() => void) => {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  };

  destroy = (): void => {
    this.listeners.clear();
    
    if (this.config.devMode) {
      console.log('CustomStateStore: Store destroyed');
    }
  };

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('CustomStateStore: Listener error', error);
      }
    });
  }

  private isEqual(a: T, b: T): boolean {
    if (this.config.equalityFn) {
      return this.config.equalityFn(a, b);
    }
    
    // Default shallow equality check
    if (Object.is(a, b)) return true;
    
    // For objects, do shallow comparison
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!(key in b) || !Object.is((a as any)[key], (b as any)[key])) {
          return false;
        }
      }
      
      return true;
    }
    
    return false;
  }
}

/**
 * Custom State Adapter Implementation
 * 
 * This provides a minimal, dependency-free state management solution
 * that implements the full StateAdapter interface.
 */
export class CustomStateAdapter<T> implements StateAdapter<T> {
  private config: CustomAdapterConfig;

  constructor(config: CustomAdapterConfig = {}) {
    this.config = config;
  }

  createStore(initialState: T): StateStore<T> {
    return new CustomStateStore(initialState, this.config);
  }
}

/**
 * Factory function for creating custom state adapters
 * This provides a convenient way to create pre-configured adapters
 */
export function createCustomAdapter<T>(
  config: CustomAdapterConfig = {}
): StateAdapter<T> {
  return new CustomStateAdapter<T>(config);
}

/**
 * Default custom adapter instance
 * Provides a ready-to-use adapter with sensible defaults
 */
export const customAdapter = createCustomAdapter({
  devMode: process.env.NODE_ENV === 'development',
});

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe, vi } = import.meta.vitest;

  describe('CustomStateAdapter', () => {
    it('should create a working state store', () => {
      const adapter = createCustomAdapter<{ count: number }>();
      const store = adapter.createStore({ count: 0 });

      expect(store.get()).toEqual({ count: 0 });
      
      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });
    });

    it('should support function updaters', () => {
      const adapter = createCustomAdapter<{ count: number }>();
      const store = adapter.createStore({ count: 0 });

      store.set(state => ({ count: state.count + 1 }));
      expect(store.get()).toEqual({ count: 1 });
    });

    it('should support subscriptions', () => {
      const adapter = createCustomAdapter<{ count: number }>();
      const store = adapter.createStore({ count: 0 });
      
      const listener = vi.fn();
      const unsubscribe = store.subscribe!(listener);

      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledWith({ count: 1 });

      unsubscribe();
      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should clean up resources on destroy', () => {
      const adapter = createCustomAdapter<{ count: number }>();
      const store = adapter.createStore({ count: 0 });
      
      const listener = vi.fn();
      store.subscribe!(listener);

      store.destroy!();
      store.set({ count: 1 });
      expect(listener).not.toHaveBeenCalled(); // Listeners should be cleared
    });

    it('should support custom equality functions', () => {
      const adapter = createCustomAdapter<{ count: number }>({
        equalityFn: (a, b) => (a as any).count === (b as any).count, // Custom equality
      });
      const store = adapter.createStore({ count: 0 });
      
      const listener = vi.fn();
      store.subscribe!(listener);

      // Set the same value - should not trigger listener
      store.set({ count: 0 });
      expect(listener).not.toHaveBeenCalled();

      // Set different value - should trigger listener
      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledWith({ count: 1 });
    });
  });
}