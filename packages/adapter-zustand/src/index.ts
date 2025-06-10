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
 * Creates a Zustand adapter for a Lattice app.
 *
 * This is the primary way to use Lattice with Zustand. It combines
 * an app factory with Zustand's state management.
 *
 * @param appFactory - The Lattice app factory
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
 */
export function createZustandAdapter<App>(
  appFactory: AppFactory<App>
) {
  // Infer the state type from the app factory
  type State = Parameters<Parameters<typeof appFactory>[0]>[0];
  
  // Use the runtime to create the store with inferred state type
  return createLatticeStore(appFactory, createStoreAdapter<State>());
}

/**
 * Creates a minimal Zustand adapter
 *
 * This creates a new Zustand store with minimal wrapping.
 * Used internally by createZustandAdapter.
 *
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createStoreAdapter<Model>(
  initialState?: Model
): StoreAdapter<Model> {
  // Create the Zustand store with a simple state container
  const store = zustandCreateStore<Model>(
    () =>
      ({
        ...initialState,
      }) as Model
  );

  // Track active listeners to handle edge cases
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // Notify all listeners with error handling
  const notifyListeners = () => {
    isNotifying = true;
    // Take a snapshot of listeners at the start of notification
    const currentListeners = Array.from(listeners);
    
    for (const listener of currentListeners) {
      // Don't skip listeners that were unsubscribed during this notification cycle
      // They should still be called in this cycle
      try {
        listener();
      } catch (error) {
        // Silently catch errors to ensure other listeners are called
        console.error('Error in store listener:', error);
      }
    }
    
    isNotifying = false;
    
    // Process pending unsubscribes after all listeners have been called
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  };

  // Subscribe to Zustand store once to handle all notifications
  store.subscribe(notifyListeners);

  return {
    getState: () => store.getState(),
    setState: (updates) => {
      store.setState(updates, false);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      
      return () => {
        if (isNotifying) {
          // Defer unsubscribe until after current notification cycle
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
 *
 * @param store - An existing Zustand store
 * @returns A minimal store adapter
 *
 * @example
 * ```typescript
 * const zustandStore = createStore<Model>(...);
 * const adapter = wrapZustandStore(zustandStore);
 * const store = createLatticeStore(component, adapter);
 * ```
 */
export function wrapZustandStore<Model>(
  store: StoreApi<Model>
): StoreAdapter<Model> {
  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates, false),
    subscribe: (listener) => store.subscribe(listener),
  };
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
      const createApp = (createStore: CreateStore) => {
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
          label: () => `Count: ${get().count} (×${get().multiplier} = ${get().count * get().multiplier})`,
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
      const createApp = (createStore: CreateStore) => {
        const createSlice = createStore({ 
          value: 0,
          min: 0,
          max: 100
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
                const clamped = Math.max(limits.min(), Math.min(v, limits.max()));
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
  });
}
