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
 * Pinia requires state to be an object. To support any model type (including
 * primitives and arrays), we wrap all models in a container object.
 * 
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createStoreAdapter<Model>(
  _initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create a unique store ID to ensure isolation
  const storeId = `lattice-pinia-${Date.now()}-${Math.random()}`;
  
  // Pinia requires object state, so we wrap the model
  interface StateContainer {
    model: Model;
  }
  
  // Define the Pinia store
  const useStore = defineStore<string, StateContainer>(storeId, {
    state: (): StateContainer => ({
      // Initialize with empty object, will be replaced by runtime
      model: {} as Model
    })
  });
  
  // Create the store instance
  const store = useStore();
  
  // Track initialization to handle the runtime's initial setState call
  let initialized = false;
  
  return {
    getState: (): Model => store.$state.model as Model,
    
    setState: (updates: Partial<Model>): void => {
      // First call from runtime provides full initial state
      if (!initialized) {
        initialized = true;
        store.$patch({ model: updates as Model });
        return;
      }
      
      // Determine update strategy based on model type
      const currentModel = store.$state.model;
      const isObject = typeof currentModel === 'object' && 
                      currentModel !== null && 
                      !Array.isArray(currentModel);
      
      if (isObject && typeof updates === 'object' && updates !== null) {
        // For objects: merge updates
        store.$patch({
          model: { ...currentModel, ...updates }
        });
      } else {
        // For primitives/arrays: replace entirely
        store.$patch({
          model: updates as Model
        });
      }
    },
    
    subscribe: (listener: () => void): (() => void) => {
      return store.$subscribe(() => listener());
    }
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';