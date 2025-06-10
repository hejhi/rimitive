/**
 * @fileoverview Minimal Pinia adapter for Lattice
 * 
 * This is a proof of concept for the new minimal adapter pattern.
 * Adapters only need to provide get/set/subscribe primitives.
 */

import { defineStore } from 'pinia';
import type { StoreAdapter } from '@lattice/core';

/**
 * Creates a minimal Pinia adapter
 * 
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createMinimalPiniaAdapter<Model>(
  initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create a unique store ID to ensure isolation
  const storeId = `lattice-minimal-${Date.now()}-${Math.random()}`;
  
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
    setState: (updates) => store.$patch(updates),
    subscribe: (listener) => {
      // Pinia's $subscribe returns an unsubscribe function
      return store.$subscribe(() => listener());
    }
  };
}