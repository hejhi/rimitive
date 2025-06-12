/**
 * @fileoverview store-react adapter for Lattice
 *
 * This adapter provides integration with store-react for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import type { StoreApi as StoreReactApi, StoreCreator } from '@lattice/store-react';
import type { StoreAdapter, AppFactory, CreateStore } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for store-react adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows customization of store creation
 *
 * @param stateCreator - Function that returns the initial state
 * @param createStore - Function to create the store with the state creator
 * @returns Enhanced store instance
 */
export type StoreEnhancer<State> = (
  stateCreator: StoreCreator<State>,
  createStore: (creator: StoreCreator<State>) => StoreReactApi<State>
) => StoreReactApi<State>;

/**
 * Creates a store-react adapter for a Lattice app.
 *
 * This is the primary way to use Lattice with store-react. It combines
 * an app factory with store-react's state management.
 *
 * @param appFactory - The Lattice app factory
 * @param enhancer - Optional store enhancer for customization
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by store-react
 *
 * @example
 * ```typescript
 * const createApp = (createStore: CreateStore) => {
 *   const createSlice = createStore({ count: 0 });
 *
 *   const counter = createSlice(({ get, set }) => ({
 *     count: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *
 *   return { counter };
 * };
 *
 * const store = createStoreReactAdapter(createApp);
 * store.counter.increment();
 * ```
 */
export function createStoreReactAdapter<App, State>(
  appFactory: AppFactory<App, State>,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
) {
  // Create an optimized adapter factory
  const adapterFactory = enhancer
    ? (initialState: State): StoreAdapter<State> => {
        const stateCreator: StoreCreator<State> = () => initialState;
        const store = createStoreReactStore(stateCreator, enhancer);
        return createOptimizedAdapter(store, options);
      }
    : (initialState: State): StoreAdapter<State> => {
        // Fast path: no enhancer, create minimal adapter directly
        return createFastAdapter(initialState, options);
      };

  return createLatticeStore(appFactory, adapterFactory);
}

/**
 * Creates a fast adapter for the common case (no enhancer)
 * This combines store creation and adapter in one step for better performance
 */
function createFastAdapter<State>(
  initialState: State,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Direct implementation without intermediate layers
  const listeners = new Set<() => void>();
  let state = initialState;
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();
  
  // Pre-bind error handler for performance
  const handleError = options?.onError || (
    process.env.NODE_ENV !== 'production' 
      ? (error: unknown) => console.error('Error in store listener:', error)
      : () => {} // No-op in production
  );

  return {
    getState: () => state,
    setState: (updates) => {
      const partial = typeof updates === 'function' ? updates(state) : updates;
      
      // Always update and notify (store-react pattern)
      state = { ...state, ...partial };
      
      // Optimized notification
      if (listeners.size > 0 && !isNotifying) {
        isNotifying = true;
        
        // Direct iteration over Set - safe because we defer removals
        for (const listener of listeners) {
          try {
            listener();
          } catch (error) {
            handleError(error);
          }
        }
        
        isNotifying = false;
        
        // Process deferred unsubscribes
        if (pendingUnsubscribes.size > 0) {
          for (const listener of pendingUnsubscribes) {
            listeners.delete(listener);
          }
          pendingUnsubscribes.clear();
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      // Return optimized unsubscribe function
      return () => {
        if (isNotifying) {
          // Defer unsubscribe until after notification
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    }
  };
}

/**
 * Creates an optimized adapter from an existing store-react store
 * Used when enhancers are present
 */
function createOptimizedAdapter<State>(
  store: StoreReactApi<State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Subscribe once to the store and forward all notifications
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();
  
  const handleError = options?.onError || (
    process.env.NODE_ENV !== 'production' 
      ? (error: unknown) => console.error('Error in store listener:', error)
      : () => {}
  );
  
  // Subscribe to the underlying store once
  store.subscribe(() => {
    if (listeners.size > 0 && !isNotifying) {
      isNotifying = true;
      
      for (const listener of listeners) {
        try {
          listener();
        } catch (error) {
          handleError(error);
        }
      }
      
      isNotifying = false;
      
      // Process deferred unsubscribes
      if (pendingUnsubscribes.size > 0) {
        for (const listener of pendingUnsubscribes) {
          listeners.delete(listener);
        }
        pendingUnsubscribes.clear();
      }
    }
  });

  return {
    getState: store.getState,
    setState: store.setState,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        if (isNotifying) {
          // Defer unsubscribe until after notification
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    }
  };
}

/**
 * Creates a store-react store outside of React components
 * Only used when enhancers are present
 *
 * @param stateCreator - Function that creates the initial state
 * @param enhancer - Optional store enhancer
 * @returns A store-react store instance
 */
function createStoreReactStore<State>(
  stateCreator: StoreCreator<State>,
  enhancer?: StoreEnhancer<State>
): StoreReactApi<State> {
  // Create the basic store structure
  const listeners = new Set<() => void>();
  let state: State;
  
  // Create the store API
  const api: StoreReactApi<State> = {
    getState: () => state,
    setState: (updates) => {
      const partial = typeof updates === 'function' ? updates(state) : updates;
      
      // Always update state and notify (store-react pattern)
      state = { ...state, ...partial };
      
      // Notify all listeners
      for (const listener of listeners) {
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
      return () => {
        listeners.delete(listener);
      };
    },
    destroy: () => {
      listeners.clear();
    }
  };
  
  // Initialize the state using the creator function
  state = stateCreator(api.setState, api.getState);
  
  // Apply enhancer if provided
  if (enhancer) {
    const createStore = (creator: StoreCreator<State>) => {
      const newApi = { ...api };
      const newState = creator(newApi.setState, newApi.getState);
      state = newState;
      return newApi;
    };
    
    return enhancer(stateCreator, createStore);
  }
  
  return api;
}

/**
 * Wraps an existing store-react store as a minimal adapter
 *
 * This allows you to use an existing store-react store with Lattice.
 *
 * @param store - An existing store-react store
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 *
 * @example
 * ```typescript
 * const storeReactStore = createStoreReactStore(...);
 * const adapter = wrapStoreReact(storeReactStore);
 * const store = createLatticeStore(component, adapter);
 * ```
 */
export function wrapStoreReact<State>(
  store: StoreReactApi<State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  return createOptimizedAdapter(store, options);
}

/**
 * Creates a minimal adapter using store-react's core API
 *
 * This creates a new store-react compatible store with minimal wrapping.
 * Similar to createStoreAdapter but works directly with the state.
 *
 * @param options - Optional configuration for the adapter
 * @returns A store adapter factory
 */
export function createStoreAdapter<State>(
  options?: AdapterOptions
): (initialState: State) => StoreAdapter<State> {
  return (initialState: State) => createFastAdapter(initialState, options);
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { compose } = await import('@lattice/core');

  describe('createStoreReactAdapter - in-source tests', () => {
    it('should demonstrate the new API with resolve for selectors', () => {
      const createApp = (createStore: CreateStore<{ count: number; multiplier: number }>) => {
        const createSlice = createStore({ count: 0, multiplier: 2 });

        // Actions that mutate state
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          setMultiplier: (m: number) => set({ multiplier: m }),
        }));

        // Queries that read state
        const queries = createSlice(({ get }) => ({
          count: () => get().count,
          multiplier: () => get().multiplier,
        }));

        // Create computed views
        const computed = createSlice(({ get }) => ({
          value: () => get().count,
          doubled: () => get().count * 2,
          multiplied: () => get().count * get().multiplier,
          label: () =>
            `Count: ${get().count} (×${get().multiplier} = ${get().count * get().multiplier})`,
        }));

        return { actions, queries, computed };
      };

      const store = createStoreReactAdapter(createApp);

      // Test initial state
      expect(store.computed.value()).toBe(0);
      expect(store.computed.doubled()).toBe(0);
      expect(store.computed.multiplied()).toBe(0);
      expect(store.computed.label()).toBe('Count: 0 (×2 = 0)');

      // Test actions
      store.actions.increment();
      expect(store.computed.value()).toBe(1);
      expect(store.computed.doubled()).toBe(2);
      expect(store.computed.multiplied()).toBe(2);
      expect(store.computed.label()).toBe('Count: 1 (×2 = 2)');

      // Change multiplier
      store.actions.setMultiplier(3);
      store.actions.increment();
      expect(store.computed.value()).toBe(2);
      expect(store.computed.multiplied()).toBe(6);
      expect(store.computed.label()).toBe('Count: 2 (×3 = 6)');
    });

    it('should work with compose for slice dependencies', () => {
      const createApp = (createStore: CreateStore<{ value: number; min: number; max: number }>) => {
        const createSlice = createStore({
          value: 0,
          min: 0,
          max: 100,
        });

        // Base slices
        const valueQueries = createSlice(({ get }) => ({
          current: () => get().value,
          isMin: () => get().value === get().min,
          isMax: () => get().value === get().max,
        }));

        const limitsQueries = createSlice(({ get }) => ({
          min: () => get().min,
          max: () => get().max,
          range: () => get().max - get().min,
        }));

        // Compose slices for complex actions
        const actions = createSlice(
          compose(
            { value: valueQueries, limits: limitsQueries },
            ({ set }, { value, limits }) => ({
              increment: () => {
                if (!value.isMax()) {
                  set({ value: Math.min(value.current() + 1, limits.max()) });
                }
              },
              decrement: () => {
                if (!value.isMin()) {
                  set({ value: Math.max(value.current() - 1, limits.min()) });
                }
              },
              setValue: (v: number) => {
                const clamped = Math.max(
                  limits.min(),
                  Math.min(v, limits.max())
                );
                set({ value: clamped });
              },
              setRange: (min: number, max: number) => {
                set({ min, max });
                // Clamp current value to new range
                const current = value.current();
                if (current < min) set({ value: min });
                if (current > max) set({ value: max });
              },
            })
          )
        );

        return { actions, value: valueQueries, limits: limitsQueries };
      };

      const store = createStoreReactAdapter(createApp);

      // Test initial state
      expect(store.value.current()).toBe(0);
      expect(store.value.isMin()).toBe(true);
      expect(store.value.isMax()).toBe(false);
      expect(store.limits.range()).toBe(100);

      // Test bounded increment
      store.actions.increment();
      expect(store.value.current()).toBe(1);

      // Test setValue with clamping
      store.actions.setValue(150);
      expect(store.value.current()).toBe(100); // Clamped to max
      expect(store.value.isMax()).toBe(true);

      store.actions.setValue(-10);
      expect(store.value.current()).toBe(0); // Clamped to min

      // Test range change
      store.actions.setValue(50);
      store.actions.setRange(10, 40);
      expect(store.value.current()).toBe(40); // Clamped to new max
      expect(store.limits.min()).toBe(10);
      expect(store.limits.max()).toBe(40);
      expect(store.limits.range()).toBe(30);
    });

    it('should handle subscriptions and cleanup properly', () => {
      const createApp = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });

        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ value: get().value + 1 }),
        }));

        const queries = createSlice(({ get }) => ({
          value: () => get().value,
        }));

        return { actions, queries };
      };

      const store = createStoreReactAdapter(createApp);

      let notifyCount = 0;
      const unsubscribe = store.subscribe(() => {
        notifyCount++;
      });

      // Test subscription
      store.actions.increment();
      expect(notifyCount).toBe(1);
      expect(store.queries.value()).toBe(1);

      store.actions.increment();
      expect(notifyCount).toBe(2);
      expect(store.queries.value()).toBe(2);

      // Test unsubscribe
      unsubscribe();
      store.actions.increment();
      expect(notifyCount).toBe(2); // Should not increase
      expect(store.queries.value()).toBe(3);
    });
  });
}