/**
 * @fileoverview Svelte 5 adapter for Lattice using the adapter-first API
 *
 * This provides a clean integration between Lattice and Svelte 5 runes
 * where reactive state is passed to the adapter.
 */

import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Svelte adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Extract the state shape from a LatticeStore class
 */
export type StateFromStore<T extends LatticeStore> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K]
};

/**
 * Base class for creating Lattice stores with Svelte 5 runes.
 * 
 * Extend this class and define your state properties using $state() runes
 * for optimal performance. The class-based approach avoids deep proxy overhead
 * while maintaining reactivity.
 * 
 * @example
 * ```ts
 * // store.svelte.ts
 * import { LatticeStore, createSliceFactory } from '@lattice/adapter-svelte';
 * 
 * class AppStore extends LatticeStore {
 *   // Define reactive state properties
 *   count = $state(0);
 *   user = $state({ name: 'John', age: 25 });
 *   items = $state<string[]>([]);
 *   
 *   // Optional: Add computed properties
 *   get doubleCount() {
 *     return this.count * 2;
 *   }
 * }
 * 
 * // Create store instance and slice factory
 * const store = new AppStore();
 * export const createSlice = createSliceFactory(store);
 * ```
 */
export abstract class LatticeStore {
  /**
   * Gets the current state of the store.
   * Returns a plain object with all enumerable properties.
   */
  getState(): Record<string, any> {
    const state: Record<string, any> = {};
    
    // Get all own property descriptors (includes getters)
    const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this));
    
    for (const [key, descriptor] of Object.entries(descriptors)) {
      // Skip constructor and methods
      if (key === 'constructor' || typeof descriptor.value === 'function') {
        continue;
      }
      
      // Include properties with getters (these are our $state properties)
      if (descriptor.get) {
        state[key] = (this as any)[key];
      }
    }
    
    return state;
  }

  /**
   * Updates the state with the provided updates.
   * 
   * @param updates - Partial state updates to apply
   */
  setState(updates: Record<string, any>): void {
    // Apply updates to the reactive properties
    for (const [key, value] of Object.entries(updates)) {
      if (key in this) {
        (this as any)[key] = value;
      }
    }
  }
}

/**
 * Creates a RuntimeSliceFactory from a Svelte LatticeStore instance
 *
 * This wraps a LatticeStore with the minimal adapter interface and
 * returns a slice factory ready to use.
 *
 * @param store - The LatticeStore instance
 * @param options - Optional configuration for the adapter
 * @returns A RuntimeSliceFactory for creating slices
 *
 * @example
 * ```ts
 * import { LatticeStore, createSliceFactory } from '@lattice/adapter-svelte';
 *
 * class AppStore extends LatticeStore {
 *   count = $state(0);
 *   user = $state({ name: 'John' });
 * }
 *
 * const store = new AppStore();
 * export const createSlice = createSliceFactory(store);
 * ```
 */
export function createSliceFactory<T extends LatticeStore>(
  store: T,
  options?: AdapterOptions
): RuntimeSliceFactory<StateFromStore<T>> {
  // For error handling
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Svelte handles reactivity automatically, but we need to track listeners
  // for compatibility with the adapter interface
  const listeners = new Set<() => void>();

  const adapter: StoreAdapter<StateFromStore<T>> = {
    getState: () => store.getState() as StateFromStore<T>,
    setState: (updates) => {
      store.setState(updates);

      // Manually notify listeners (Svelte's reactivity handles UI updates)
      // This ensures compatibility with non-Svelte consumers
      for (const listener of listeners) {
        try {
          listener();
        } catch (error) {
          handleError(error);
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return createLatticeStore(adapter);
}

// Re-export types for convenience
export type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';