/**
 * @fileoverview Svelte 5 adapter for Lattice using the adapter-first API
 *
 * This provides a clean integration between Lattice and Svelte 5 runes
 * where reactive state is passed to the adapter.
 */

import type { StoreAdapter } from '@lattice/core';

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
 * Base class for creating Lattice stores with Svelte 5 runes.
 * 
 * Extend this class and define your state properties using $state() runes
 * for optimal performance. The class-based approach avoids deep proxy overhead
 * while maintaining reactivity.
 * 
 * @example
 * ```ts
 * // store.svelte.ts
 * import { LatticeStore, createStoreAdapter } from '@lattice/adapter-svelte';
 * import { createLatticeStore } from '@lattice/core';
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
 * // Create store instance
 * const store = new AppStore();
 * 
 * // Create adapter and slice factory
 * const adapter = createStoreAdapter(store);
 * export const createSlice = createLatticeStore(adapter);
 * ```
 */
export abstract class LatticeStore {
  /**
   * Gets the current state of the store.
   * Returns a plain object with all enumerable properties.
   */
  getState(): Record<string, any> {
    const state: Record<string, any> = {};
    
    // Get all enumerable properties from the instance
    for (const key of Object.keys(this)) {
      state[key] = (this as any)[key];
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
 * Creates a minimal adapter from a Svelte LatticeStore instance
 *
 * This wraps a LatticeStore with the minimal adapter interface.
 * Svelte handles all reactivity through its runes system.
 *
 * @param store - The LatticeStore instance
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 *
 * @example
 * ```ts
 * import { LatticeStore, createStoreAdapter } from '@lattice/adapter-svelte';
 * import { createLatticeStore } from '@lattice/core';
 *
 * class AppStore extends LatticeStore {
 *   count = $state(0);
 *   user = $state({ name: 'John' });
 * }
 *
 * const store = new AppStore();
 * const adapter = createStoreAdapter(store);
 * export const createSlice = createLatticeStore(adapter);
 * ```
 */
export function createStoreAdapter<T extends LatticeStore>(
  store: T,
  options?: AdapterOptions
): StoreAdapter<T> {
  // For error handling
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Svelte handles reactivity automatically, but we need to track listeners
  // for compatibility with the adapter interface
  const listeners = new Set<() => void>();

  return {
    getState: () => store.getState() as T,
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
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';