/**
 * @fileoverview Pinia adapter for Lattice
 *
 * This adapter provides integration with Pinia for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createPinia, defineStore, type Pinia, type Store } from 'pinia';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Pinia adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows plugin composition
 *
 * @param stateCreator - Function that returns the initial state
 * @param pinia - The Pinia instance to enhance
 * @param storeId - The unique store ID
 * @returns Enhanced Pinia store instance
 */
export type StoreEnhancer<State extends Record<string, any>> = (
  stateCreator: () => State,
  pinia: Pinia,
  storeId: string
) => Store<string, State>;

/**
 * Creates a Lattice store using Pinia for state management.
 *
 * @param initialState - The initial state for the store
 * @param options - Optional configuration including plugin enhancer
 * @returns A RuntimeSliceFactory for creating slices
 *
 * @example
 * ```typescript
 * import { createStore } from '@lattice/adapter-pinia';
 *
 * const createSlice = createStore({ count: 0 });
 *
 * const createComponent = (createSlice) => {
 *   const counter = createSlice(({ get, set }) => ({
 *     count: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *
 *   return { counter };
 * };
 *
 * const component = createComponent(createSlice);
 * component.counter.selector.increment();
 * ```
 *
 * @example With plugins
 * ```typescript
 * import { createPersistedState } from 'pinia-plugin-persistedstate';
 *
 * const createSlice = createStore(
 *   { count: 0 },
 *   {
 *     enhancer: (stateCreator, pinia, storeId) => {
 *       pinia.use(createPersistedState({
 *         key: id => `__persisted__${id}`,
 *         storage: localStorage,
 *       }));
 *
 *       const useStore = defineStore(storeId, {
 *         state: stateCreator
 *       });
 *
 *       return useStore(pinia);
 *     }
 *   }
 * );
 * ```
 */
export function createStore<State extends Record<string, any>>(
  initialState: State,
  options?: AdapterOptions & { enhancer?: StoreEnhancer<State> }
): RuntimeSliceFactory<State> {
  const pinia = createPinia();
  const storeId = `lattice-${Date.now()}-${Math.random()}`;

  // Create store with or without enhancer
  const store = options?.enhancer
    ? options.enhancer(() => initialState, pinia, storeId)
    : createDefaultStore(() => initialState, pinia, storeId);

  const adapter = createStoreAdapter(store, options);

  // Return the slice factory
  return createLatticeStore(adapter);
}

/**
 * Creates a Pinia adapter for a Lattice component.
 *
 * @deprecated Use createStore instead for the new adapter-first API
 *
 * @param componentFactory - The Lattice component factory
 * @param enhancer - Optional store enhancer for plugins
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by Pinia
 */
export function createPiniaAdapter<
  Component,
  State extends Record<string, any> = any,
>(
  componentFactory: (createStore: (initialState: State) => RuntimeSliceFactory<State>) => Component,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
) {
  // For backwards compatibility, create a function that mimics the old API
  const createStoreFunction = (initialState: State) => {
    return createStore(initialState, { ...options, enhancer });
  };
  
  return componentFactory(createStoreFunction);
}

/**
 * Creates a default Pinia store
 */
function createDefaultStore<State extends Record<string, any>>(
  stateCreator: () => State,
  pinia: Pinia,
  storeId: string
): Store<string, State> {
  const useStore = defineStore(storeId, {
    state: stateCreator,
  });

  return useStore(pinia);
}

/**
 * Creates a minimal adapter from a Pinia store
 *
 * This wraps a Pinia store with minimal adapter interface.
 * Handles edge cases like unsubscribe during notification.
 *
 * @param store - The Pinia store to wrap
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 */
export function createStoreAdapter<State extends Record<string, any>>(
  store: Store<string, State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Track listeners for edge case handling
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // For error handling
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Subscribe to Pinia and forward to our listeners
  store.$subscribe(() => {
    isNotifying = true;
    const currentListeners = Array.from(listeners);

    for (const listener of currentListeners) {
      try {
        listener();
      } catch (error) {
        handleError(error);
      }
    }

    isNotifying = false;

    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => {
      // Return a deep copy to prevent mutation of the original state
      // Pinia's state is reactive, so we need to ensure we return plain objects
      return JSON.parse(JSON.stringify(store.$state)) as State;
    },
    setState: (updates) => {
      // Pinia's $patch expects the updates to be compatible with UnwrapRef<State>
      // We use a function to avoid type issues with Vue's reactivity system
      store.$patch((state) => {
        Object.assign(state as any, updates);
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        if (isNotifying) {
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
  };
}

/**
 * Wraps an existing Pinia store as a minimal adapter
 *
 * This allows you to use an existing Pinia store with Lattice.
 * Uses the same sophisticated subscription management as createStoreAdapter
 * to handle edge cases like unsubscribe during notification.
 *
 * @param store - An existing Pinia store
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with proper subscription management
 *
 * @example
 * ```typescript
 * const piniaStore = useCounterStore();
 * const adapter = wrapPiniaStore(piniaStore);
 * const store = createLatticeStore(componentFactory, adapter);
 * ```
 */
export function wrapPiniaStore<State extends Record<string, any>>(
  store: Store<string, State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  return createStoreAdapter(store, options);
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
export type { SubscribableStore } from '@lattice/core';

// Note: Vue composables are available from '@lattice/runtime/vue'
// They work with any adapter including this Pinia adapter
