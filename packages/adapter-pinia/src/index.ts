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
export function createPiniaAdapter<Model, Actions, Views>(
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
export function createStoreAdapter<Model>(
  initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create a unique store ID to ensure isolation
  const storeId = `lattice-pinia-${Date.now()}-${Math.random()}`;
  
  // Pinia requires state to be an object. For non-object models,
  // we wrap them in a container object.
  type StateContainer = Model extends object ? Model : { value: Model };
  const isObjectModel = (v: unknown): v is object => 
    typeof v === 'object' && v !== null && !Array.isArray(v);
  
  // Define the Pinia store with proper state handling
  const useStore = defineStore(storeId, {
    state: (): StateContainer => {
      if (isObjectModel(initialState)) {
        return { ...initialState } as StateContainer;
      }
      // For primitives, arrays, or null/undefined, wrap in container
      return { value: initialState } as StateContainer;
    }
  });
  
  // Create the store instance
  const store = useStore();
  
  // Determine if we need to wrap/unwrap values
  const needsWrapping = !isObjectModel(initialState);
  
  return {
    getState: (): Model => {
      if (needsWrapping) {
        return (store.$state as any).value as Model;
      }
      return store.$state as Model;
    },
    setState: (updates: Partial<Model>) => {
      if (needsWrapping) {
        // For wrapped values, update the container
        const patchData = { value: updates };
        (store as any).$patch(patchData);
      } else {
        // For object models, patch directly
        // Use any cast to avoid Vue's deep type recursion
        (store as any).$patch(updates);
      }
    },
    subscribe: (listener: () => void) => {
      // Pinia's $subscribe returns an unsubscribe function
      return store.$subscribe(() => listener());
    }
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';