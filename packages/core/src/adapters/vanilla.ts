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
  // Create state object once, mutate in place
  const state = { ...initialState };
  const listeners = new Set<() => void>();
  let lastChangedKeys: (keyof State)[] = [];

  return {
    getState: () => state, // Return reference directly - caller must not mutate!
    setState: (updates) => {
      // Track which keys actually changed
      lastChangedKeys = [];
      
      // Update state in place, only for changed values
      for (const key in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          const typedKey = key as keyof State;
          const newValue = updates[typedKey];
          if (!Object.is(state[typedKey], newValue)) {
            (state as any)[typedKey] = newValue;
            lastChangedKeys.push(typedKey);
          }
        }
      }
      
      // Only notify if something actually changed
      if (lastChangedKeys.length > 0) {
        for (const listener of listeners) {
          listener();
        }
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
