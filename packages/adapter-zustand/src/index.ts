/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createStore as zustandCreateStore, StoreApi } from 'zustand/vanilla';
import type { StoreAdapter, AdapterFactory, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Zustand adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows middleware composition
 *
 * @param stateCreator - Function that returns the initial state
 * @param createStore - Zustand's createStore function
 * @returns Enhanced store instance
 */
export type StoreEnhancer<State> = (
  stateCreator: () => State,
  createStore: typeof zustandCreateStore
) => StoreApi<State>;

/**
 * Creates a Lattice store using Zustand for state management.
 *
 * @param initialState - The initial state for the store
 * @param options - Optional configuration including middleware enhancer
 * @returns A RuntimeSliceFactory for creating slices
 *
 * @example
 * ```typescript
 * import { createStore } from '@lattice/adapter-zustand';
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
 * @example With middleware
 * ```typescript
 * import { persist } from 'zustand/middleware';
 *
 * const createSlice = createStore(
 *   { count: 0 },
 *   {
 *     enhancer: (stateCreator, createStore) =>
 *       createStore(persist(stateCreator, { name: 'app-storage' }))
 *   }
 * );
 * ```
 */
export function createStore<State>(
  initialState: State,
  options?: AdapterOptions & { enhancer?: StoreEnhancer<State> }
): RuntimeSliceFactory<State> {
  // Create Zustand store with initial state, optionally enhanced
  const store = options?.enhancer
    ? options.enhancer(() => initialState, zustandCreateStore)
    : zustandCreateStore<State>(() => initialState);

  // Create adapter from the Zustand store
  const adapter = createStoreAdapter(store, options);

  // Return the slice factory
  return createLatticeStore(adapter);
}

/**
 * Creates a Zustand adapter factory for use with Lattice.
 *
 * @deprecated Use createStore instead for the new adapter-first API
 *
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns An adapter factory for use with createLatticeStore
 */
export function createZustandAdapter<State>(
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
): AdapterFactory<State> {
  // Return an adapter factory that will be called with initial state
  return (initialState: State): StoreAdapter<State> => {
    // Create Zustand store with initial state, optionally enhanced
    const store = enhancer
      ? enhancer(() => initialState, zustandCreateStore)
      : zustandCreateStore<State>(() => initialState);

    return createStoreAdapter(store, options);
  };
}

/**
 * Creates a minimal adapter from a Zustand store
 *
 * This wraps a Zustand store with minimal adapter interface.
 * We mostly pass through Zustand's native methods directly to ensure
 * middleware and all Zustand features work correctly, but we add
 * error handling and proper unsubscribe-during-notification support.
 *
 * @param store - The Zustand store to wrap
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 */
export function createStoreAdapter<State>(
  store: StoreApi<State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // For error handling
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Performance optimization: Direct listener management without double subscription
  const listeners = new Set<() => void>();
  const pendingUnsubscribes = new Set<() => void>();
  let isNotifying = false;

  // Subscribe to Zustand store once
  store.subscribe(() => {
    // Notify all listeners
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

    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates),
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
 * Wraps an existing Zustand store as a minimal adapter
 *
 * This allows you to use an existing Zustand store with Lattice.
 * Uses the same sophisticated subscription management as createStoreAdapter
 * to handle edge cases like unsubscribe during notification.
 *
 * Note: This is now less commonly used since createZustandAdapter
 * handles most use cases including middleware.
 *
 * @param store - An existing Zustand store
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with proper subscription management
 *
 * @example
 * ```typescript
 * const zustandStore = createStore<Model>(...);
 * const adapter = wrapZustandStore(zustandStore);
 * const store = createLatticeStore(component, (initialState) => adapter);
 * ```
 */
export function wrapZustandStore<Model>(
  store: StoreApi<Model>,
  options?: AdapterOptions
): StoreAdapter<Model> {
  return createStoreAdapter(store, options);
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
