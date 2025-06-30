/**
 * @fileoverview Built-in adapters for common use cases
 */

import type { StoreAdapter } from './adapter-contract';

/**
 * Creates a simple in-memory adapter for Lattice stores.
 * This is the most basic adapter - stores state in memory with no persistence.
 *
 * @param initialState - The initial state for the store
 * @returns A StoreAdapter that can be used with createStoreWithAdapter
 */
export function vanillaAdapter<State extends Record<string, any>>(
  initialState: State
): StoreAdapter<State> {
  let state = { ...initialState };
  const listeners = new Set<() => void>();

  return {
    getState: () => ({ ...state }),
    setState: (updates) => {
      state = { ...state, ...updates };
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
