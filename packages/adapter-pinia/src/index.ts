/**
 * @fileoverview Pinia adapter for Lattice
 *
 * Provides a clean adapter that wraps existing Pinia stores for use with Lattice.
 * The adapter preserves all Pinia features while providing the minimal interface
 * required by Lattice.
 */

import type { Store } from 'pinia';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for the Pinia adapter
 */
export interface PiniaAdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Creates a Lattice adapter from an existing Pinia store.
 *
 * This adapter wraps any Pinia store, preserving all its features
 * (plugins, devtools, persistence, etc.) while providing the minimal
 * interface required by Lattice.
 *
 * @param store - An existing Pinia store instance
 * @param options - Optional configuration for the adapter
 * @returns A RuntimeSliceFactory for creating Lattice slices
 *
 * @example
 * ```typescript
 * import { defineStore } from 'pinia';
 * import { piniaAdapter } from '@lattice/adapter-pinia';
 *
 * // Create a Pinia store using the native API
 * const useCounterStore = defineStore('counter', {
 *   state: () => ({ count: 0 }),
 *   actions: {
 *     increment() {
 *       this.count++;
 *     }
 *   }
 * });
 *
 * // Get the store instance
 * const store = useCounterStore();
 *
 * // Wrap it with the adapter
 * const createSlice = piniaAdapter(store);
 *
 * // Use with Lattice components
 * const component = myComponent(createSlice);
 * ```
 *
 * @example With plugins
 * ```typescript
 * import { createPinia, defineStore } from 'pinia';
 * import { createPersistedState } from 'pinia-plugin-persistedstate';
 * import { piniaAdapter } from '@lattice/adapter-pinia';
 *
 * // Create Pinia instance with plugins
 * const pinia = createPinia();
 * pinia.use(createPersistedState());
 *
 * // Define store
 * const useAppStore = defineStore('app', {
 *   state: () => ({ user: null, theme: 'light' }),
 *   persist: true
 * });
 *
 * // Create store instance with pinia
 * const store = useAppStore(pinia);
 *
 * // Wrap with adapter
 * const createSlice = piniaAdapter(store);
 * ```
 */
export function piniaAdapter<State extends Record<string, any>>(
  store: Store<string, State>,
  options?: PiniaAdapterOptions
): RuntimeSliceFactory<State> {
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Performance optimization: Direct listener management
  const listeners = new Set<() => void>();
  const pendingUnsubscribes = new Set<() => void>();
  let isNotifying = false;

  // Subscribe to Pinia store once
  store.$subscribe(() => {
    isNotifying = true;

    // Use for...of directly on the Set to avoid array allocation
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        handleError(error);
      }
    }

    isNotifying = false;

    // Process pending unsubscribes after notification
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  const adapter: StoreAdapter<State> = {
    getState: () => {
      // Return a deep copy to prevent external mutations
      // Pinia's state is reactive, so we ensure plain objects
      return JSON.parse(JSON.stringify(store.$state)) as State;
    },
    setState: (updates) => {
      // Use $patch with a function to handle Vue's reactivity
      store.$patch((state) => {
        Object.assign(state as any, updates);
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        if (isNotifying) {
          // Defer unsubscribe until after current notification
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
  };

  return createLatticeStore(adapter);
}
