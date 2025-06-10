/**
 * @fileoverview Pinia adapter for Lattice
 *
 * This adapter provides integration with Pinia, Vue's official state
 * management library, following the minimal adapter pattern.
 */

import { defineStore } from 'pinia';
import type { StoreAdapter, ComponentFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Creates a Pinia adapter for a Lattice component.
 *
 * This follows the minimal adapter pattern where adapters only provide
 * get/set/subscribe primitives, and the runtime handles all complexity.
 *
 * @param componentFactory - The Lattice component spec factory
 * @returns A Lattice store backed by Pinia
 *
 * @example
 * ```typescript
 * const counter = () => ({
 *   model: createModel(...),
 *   actions: createSlice(...),
 *   views: { ... }
 * });
 *
 * const store = createPiniaAdapter(counter);
 * store.actions.increment();
 * const view = store.views.display();
 * ```
 */
export function createPiniaAdapter<
  Model extends Record<string, unknown>,
  Actions,
  Views,
>(componentFactory: ComponentFactory<Model, Actions, Views>) {
  // Use the runtime to create the store
  return createLatticeStore(componentFactory, createStoreAdapter<Model>());
}

/**
 * Creates a minimal Pinia adapter
 *
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createStoreAdapter<Model extends Record<string, unknown>>(
  initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create a unique store ID to ensure isolation
  const storeId = `lattice-pinia-${Date.now()}-${Math.random()}`;

  // Define the Pinia store
  const useStore = defineStore(storeId, {
    state: () => ({
      ...initialState,
    }),
  });

  // Create the store instance
  const store = useStore();

  // Track listeners to handle edge cases
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // Notify all listeners with error handling
  const notifyListeners = () => {
    isNotifying = true;
    const currentListeners = Array.from(listeners);
    
    for (const listener of currentListeners) {
      try {
        listener();
      } catch (error) {
        // Silently catch errors to ensure other listeners are called
        console.error('Error in store listener:', error);
      }
    }
    
    isNotifying = false;
    
    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  };

  // Subscribe to Pinia store to handle all notifications
  store.$subscribe(notifyListeners);

  return {
    getState: () => {
      // Return a deep copy to prevent mutation of the original state
      return JSON.parse(JSON.stringify(store.$state)) as Model;
    },
    setState: (updates) => {
      store.$patch(updates);
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

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
