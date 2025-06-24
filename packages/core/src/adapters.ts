/**
 * @fileoverview Built-in adapters for common use cases
 * 
 * These adapters provide simple backends for createLatticeStore,
 * allowing users to get started quickly without external dependencies.
 */

import type { StoreAdapter } from './adapter-contract';
import type { ReactiveSliceFactory } from './runtime-types';

/**
 * Creates a simple in-memory adapter for Lattice stores.
 * This is the most basic adapter - stores state in memory with no persistence.
 * 
 * @param initialState - The initial state for the store
 * @returns A StoreAdapter that can be used with createLatticeStore
 * 
 * @example
 * ```typescript
 * import { createLatticeStore, vanillaAdapter } from '@lattice/core';
 * 
 * const adapter = vanillaAdapter({ count: 0, name: "John" });
 * const createSlice = createLatticeStore(adapter);
 * 
 * const counter = createSlice(
 *   (selectors) => ({ count: selectors.count }),
 *   ({ count }, set) => ({
 *     increment: () => set(
 *       ({ count }) => ({ count: count() + 1 })
 *     )
 *   })
 * );
 * ```
 */
export function vanillaAdapter<State extends Record<string, unknown>>(
  initialState: State
): StoreAdapter<State> {
  let state = initialState;
  const listeners = new Set<() => void>();
  
  return {
    getState: () => state,
    setState: (updates: Partial<State>) => {
      // Only update if something actually changed
      let hasChanges = false;
      for (const key in updates) {
        const newValue = updates[key];
        if (newValue !== undefined && !Object.is(state[key], newValue)) {
          hasChanges = true;
          break;
        }
      }
      
      if (hasChanges) {
        // Direct mutation for performance (like our optimized createStore)
        for (const key in updates) {
          const newValue = updates[key];
          if (newValue !== undefined) {
            state[key] = newValue;
          }
        }
        
        // Notify all listeners
        listeners.forEach(listener => listener());
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/**
 * Convenience function that combines vanillaAdapter + createLatticeStore.
 * This provides the same API as the old createStore but uses the adapter pattern.
 * 
 * @param initialState - The initial state for the store
 * @returns A ReactiveSliceFactory for creating slices
 * 
 * @example
 * ```typescript
 * import { createStore } from '@lattice/core';
 * 
 * // Same API as before, but now using adapters under the hood
 * const createSlice = createStore({ count: 0, name: "John" });
 * ```
 */
export function createStore<State extends Record<string, unknown>>(
  initialState: State
): ReactiveSliceFactory<State> {
  // Import here to avoid circular dependency
  const { createLatticeStore } = require('./runtime') as typeof import('./runtime');
  const adapter = vanillaAdapter(initialState);
  return createLatticeStore(adapter);
}