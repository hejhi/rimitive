/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createStore as zustandCreateStore, StoreApi } from 'zustand/vanilla';
import type { StoreAdapter, AppFactory, CreateStore } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Zustand adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows middleware composition
 *
 * @param stateCreator - Function that returns the initial state
 * @param createStore - Zustand's createStore function
 * @returns Enhanced store instance
 */
export type StoreEnhancer<State> = (
  stateCreator: () => State,
  createStore: typeof zustandCreateStore
) => StoreApi<State>;

/**
 * Creates a Zustand adapter for a Lattice app.
 *
 * This is the primary way to use Lattice with Zustand. It combines
 * an app factory with Zustand's state management.
 *
 * @param appFactory - The Lattice app factory
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by Zustand
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
 * const store = createZustandAdapter(createApp);
 * store.counter.increment();
 * ```
 *
 * @example With middleware
 * ```typescript
 * import { persist } from 'zustand/middleware';
 *
 * const store = createZustandAdapter(createApp, (stateCreator, createStore) =>
 *   createStore(persist(stateCreator, { name: 'app-storage' }))
 * );
 * ```
 */
export function createZustandAdapter<App, State>(
  appFactory: AppFactory<App, State>,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
) {
  // Create an adapter factory that will be called with initial state
  const adapterFactory = (initialState: State): StoreAdapter<State> => {
    // Create Zustand store with initial state, optionally enhanced
    const store = enhancer
      ? enhancer(() => initialState, zustandCreateStore)
      : zustandCreateStore<State>(() => initialState);

    return createStoreAdapter(store, options);
  };

  return createLatticeStore(appFactory, adapterFactory);
}

/**
 * Creates a minimal adapter from a Zustand store
 *
 * This wraps a Zustand store with minimal adapter interface.
 * We mostly pass through Zustand's native methods directly to ensure
 * middleware and all Zustand features work correctly, but we add
 * error handling and proper unsubscribe-during-notification support.
 *
 * @param store - The Zustand store to wrap
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 */
export function createStoreAdapter<State>(
  store: StoreApi<State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Track listeners for edge case handling
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // For error handling
  const handleError = options?.onError ?? ((error) => {
    console.error('Error in store listener:', error);
  });

  // Subscribe to Zustand and forward to our listeners
  store.subscribe(() => {
    isNotifying = true;
    const currentListeners = Array.from(listeners);
    
    for (const listener of currentListeners) {
      try {
        listener();
      } catch (error) {
        handleError(error);
      }
    }
    
    isNotifying = false;
    
    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates),
    subscribe: (listener) => {
      listeners.add(listener);
      
      return () => {
        if (isNotifying) {
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
  };
}

/**
 * Wraps an existing Zustand store as a minimal adapter
 *
 * This allows you to use an existing Zustand store with Lattice.
 * Uses the same sophisticated subscription management as createStoreAdapter
 * to handle edge cases like unsubscribe during notification.
 *
 * Note: This is now less commonly used since createZustandAdapter
 * handles most use cases including middleware.
 *
 * @param store - An existing Zustand store
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with proper subscription management
 *
 * @example
 * ```typescript
 * const zustandStore = createStore<Model>(...);
 * const adapter = wrapZustandStore(zustandStore);
 * const store = createLatticeStore(component, (initialState) => adapter);
 * ```
 */
export function wrapZustandStore<Model>(
  store: StoreApi<Model>,
  options?: AdapterOptions
): StoreAdapter<Model> {
  return createStoreAdapter(store, options);
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { compose } = await import('@lattice/core');

  describe('createZustandAdapter - in-source tests', () => {
    it('should demonstrate the new API with resolve for selectors', () => {
      const createApp = (
        createStore: CreateStore<{ count: number; multiplier: number }>
      ) => {
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

      const store = createZustandAdapter(createApp);

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
      const createApp = (
        createStore: CreateStore<{ value: number; min: number; max: number }>
      ) => {
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

      const store = createZustandAdapter(createApp);

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

    it('should work with middleware enhancer', () => {
      // Track middleware interactions
      const middlewareCalls: string[] = [];

      // Simple logging middleware that demonstrates the enhancer pattern
      const loggingMiddleware = (config: any) => (set: any, get: any, api: any) => {
        middlewareCalls.push('middleware:init');
        
        const wrappedSet = (...args: any[]) => {
          middlewareCalls.push('middleware:setState');
          const prevState = get();
          set(...args);
          const nextState = get();
          middlewareCalls.push(`state:${JSON.stringify(prevState)}->${JSON.stringify(nextState)}`);
        };
        
        // Critical: mutate api.setState so external calls use the wrapped version
        api.setState = wrappedSet;
        
        return config(wrappedSet, get, api);
      };

      // Create app
      const createApp = (
        createStore: CreateStore<{ count: number; name: string }>
      ) => {
        const createSlice = createStore({ count: 0, name: 'test' });

        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name }),
          reset: () => set({ count: 0, name: 'test' }),
        }));

        const queries = createSlice(({ get }) => ({
          count: () => get().count,
          name: () => get().name,
          summary: () => `${get().name}: ${get().count}`,
        }));

        return { actions, queries };
      };

      // Create store with middleware enhancer
      const store = createZustandAdapter(
        createApp,
        (stateCreator, createStore) =>
          createStore(loggingMiddleware(stateCreator))
      );

      // Verify middleware was initialized
      expect(middlewareCalls).toContain('middleware:init');

      // Verify initial state
      expect(store.queries.count()).toBe(0);
      expect(store.queries.name()).toBe('test');

      // Clear the calls to check only action calls
      const initCalls = middlewareCalls.length;

      // Make some changes
      store.actions.increment();
      expect(middlewareCalls.slice(initCalls)).toContain('middleware:setState');
      
      store.actions.setName('updated');
      expect(store.queries.name()).toBe('updated');

      // Verify middleware intercepted all setState calls
      const setStateCalls = middlewareCalls.filter(call => call === 'middleware:setState').length;
      expect(setStateCalls).toBeGreaterThan(0);

      // Verify state changes were logged
      const stateChanges = middlewareCalls.filter(call => call.startsWith('state:'));
      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some(change => change.includes('"count":1'))).toBe(true);

      // Test subscriptions still work with middleware
      let notificationCount = 0;
      const unsubscribe = store.subscribe(() => {
        notificationCount++;
      });

      store.actions.increment();
      expect(notificationCount).toBe(1);
      expect(store.queries.count()).toBe(2);

      unsubscribe();
      store.actions.increment();
      expect(notificationCount).toBe(1); // Should not increase after unsubscribe

      // Verify the enhancer pattern allows native Zustand features
      expect(typeof store.subscribe).toBe('function');
    });
  });
}
