/**
 * @fileoverview Built-in adapters for common use cases
 */

import type { ChangeTrackingAdapter } from './contract';

/**
 * Creates a simple in-memory adapter for Lattice stores.
 * This is the most basic adapter - stores state in memory with no persistence.
 *
 * @param initialState - The initial state for the store
 * @returns A StoreAdapter that can be used with createStoreWithAdapter
 */
export function vanillaAdapter<State extends Record<string, any>>(
  initialState: State
): ChangeTrackingAdapter<State> {
  let state = { ...initialState };
  const listeners = new Set<() => void>();
  let lastChangedKeys: (keyof State)[] = [];

  return {
    getState: () => ({ ...state }),
    setState: (updates) => {
      // Track which keys actually changed
      lastChangedKeys = [];
      const prevState = state;
      state = { ...state, ...updates };
      
      // Only track keys where the value actually changed
      for (const key in updates) {
        if (!Object.is(prevState[key], state[key])) {
          lastChangedKeys.push(key as keyof State);
        }
      }
      
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Extension to get changed keys (not part of standard interface)
    _getLastChangedKeys: () => lastChangedKeys,
  };
}
