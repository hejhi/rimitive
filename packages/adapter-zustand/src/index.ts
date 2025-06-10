/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createStore as zustandCreateStore, StoreApi } from 'zustand/vanilla';
import type { StoreAdapter, ComponentFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Creates a Zustand adapter for a Lattice component.
 *
 * This is the primary way to use Lattice with Zustand. It combines
 * a component specification with Zustand's state management.
 *
 * @param componentFactory - The Lattice component spec factory
 * @returns A Lattice store backed by Zustand
 *
 * @example
 * ```typescript
 * const counter = () => ({
 *   model: createModel(...),
 *   actions: createSlice(...),
 *   views: { ... }
 * });
 *
 * const store = createZustandAdapter(counter);
 * store.actions.increment();
 * const view = store.views.display();
 * ```
 */
export function createZustandAdapter<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>
) {
  // Use the runtime to create the store
  return createLatticeStore(componentFactory, createStoreAdapter<Model>());
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
  const { describe, it, expect, vi } = import.meta.vitest;
  const { createStore, compose, resolve } = await import('@lattice/core');

  describe('createZustandAdapter - minimal implementation', () => {
    it('should work with the minimal adapter pattern', () => {
      const createApp = (createStore: any) => {
        const createSlice = createStore({ count: 0 });
        
        const counter = createSlice(({ get, set }) => ({
          count: () => get().count,
          increment: () => set({ count: get().count + 1 }),
        }));
        
        const views = createSlice(({ get }) => ({
          display: () => ({
            value: get().count,
            label: `Count: ${get().count}`,
          }),
        }));
        
        return { counter, views };
      };

      const store = createZustandAdapter(createApp);

      // Test initial state
      const view = store.views.display();
      expect(view.value).toBe(0);
      expect(view.label).toBe('Count: 0');

      // Test actions
      store.counter.increment();

      // Test updated view
      const updatedView = store.views.display();
      expect(updatedView.value).toBe(1);
      expect(updatedView.label).toBe('Count: 1');
    });

    it('should support subscriptions', () => {
      const createApp = (createStore: any) => {
        const createSlice = createStore({ value: 0 });
        
        const actions = createSlice(({ get, set }) => ({
          setValue: (v: number) => set({ value: v }),
        }));
        
        const queries = createSlice(({ get }) => ({
          current: () => ({ value: get().value }),
        }));
        
        return { actions, queries };
      };

      const store = createZustandAdapter(createApp);

      // Track subscription calls
      let callCount = 0;
      const unsubscribe = store.subscribe(() => {
        callCount++;
      });

      // Initial state
      expect(store.queries.current().value).toBe(0);
      expect(callCount).toBe(0);

      // Update state
      store.actions.setValue(42);
      expect(store.queries.current().value).toBe(42);
      expect(callCount).toBe(1);

      // Unsubscribe
      unsubscribe();
      store.actions.setValue(100);
      expect(callCount).toBe(1); // No more calls
    });
  });
}
