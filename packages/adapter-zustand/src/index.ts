/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createStore as zustandCreateStore, StoreApi } from 'zustand/vanilla';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
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

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
