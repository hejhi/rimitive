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
export function createPiniaAdapter<Model extends Record<string, unknown>, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>
) {
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
  
  // Define the Pinia store with initial state
  const useStore = defineStore(storeId, {
    state: () => ({
      ...initialState
    } as Model)
  });
  
  // Create the store instance
  const store = useStore();
  
  return {
    getState: () => store.$state as Model,
    setState: (updates) => {
      // Pinia's $patch expects _DeepPartial<UnwrapRef<S>> but we have Partial<Model>
      // The type mismatch is due to Vue's ref unwrapping system
      // We need to cast through unknown to avoid excessive stack depth errors
      store.$patch(updates as unknown as Parameters<typeof store.$patch>[0]);
    },
    subscribe: (listener) => {
      // Pinia's $subscribe returns an unsubscribe function
      return store.$subscribe(() => listener());
    }
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';