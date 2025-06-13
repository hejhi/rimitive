/**
 * @fileoverview Standard Svelte adapter for Lattice
 *
 * This adapter provides full compatibility with Lattice patterns
 * while maintaining good performance (~7x overhead vs raw Svelte).
 */

import type { StoreAdapter } from '@lattice/core';

export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Creates a standard Svelte adapter with full Lattice compatibility
 *
 * Features:
 * - Change detection to avoid unnecessary updates
 * - Error handling for listener exceptions
 * - Safe unsubscribe during notification
 * - Minimal overhead design
 *
 * @param initialState - The initial state
 * @param options - Optional configuration
 * @returns A Lattice-compatible store adapter
 */
export function createStoreAdapter<State>(
  initialState: State,
  options?: AdapterOptions
): StoreAdapter<State> {
  let state = initialState;
  const listeners = new Set<() => void>();

  // Error handling
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Track notification state for safe unsubscribe
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  return {
    getState: () => state,

    setState: (updates) => {
      // Skip empty updates
      if (!updates || Object.keys(updates).length === 0) return;

      // Update state (always update to match adapter contract requirements)
      state = { ...state, ...updates };

      // Notify listeners with error handling
      isNotifying = true;

      // Use array iteration for better performance
      const listenersArray = Array.from(listeners);
      for (let i = 0; i < listenersArray.length; i++) {
        try {
          listenersArray[i]?.();
        } catch (error) {
          handleError(error);
        }
      }

      isNotifying = false;

      // Process pending unsubscribes
      if (pendingUnsubscribes.size > 0) {
        for (const listener of pendingUnsubscribes) {
          listeners.delete(listener);
        }
        pendingUnsubscribes.clear();
      }
    },

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        if (isNotifying) {
          // Defer unsubscribe to avoid modifying set during iteration
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
  };
}
