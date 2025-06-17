/**
 * @fileoverview Zustand adapter for Lattice
 *
 * Provides a clean adapter pattern for integrating existing Zustand stores
 * with Lattice components. Users create their stores with Zustand's native
 * API and wrap them with this adapter.
 */

import type { StoreApi } from 'zustand';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for the Zustand adapter
 */
export interface ZustandAdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Creates a Lattice adapter from an existing Zustand store.
 *
 * This adapter wraps any Zustand store (including those with middleware)
 * to work seamlessly with Lattice components. The store retains all its
 * native functionality including middleware, devtools, persistence, etc.
 *
 * @param store - An existing Zustand store created with zustand/vanilla or zustand
 * @param options - Optional configuration for error handling
 * @returns A RuntimeSliceFactory for creating Lattice slices
 *
 * @example
 * ```typescript
 * import { create } from 'zustand';
 * import { zustandAdapter } from '@lattice/adapter-zustand';
 *
 * // Create a Zustand store with native API
 * const useStore = create((set) => ({
 *   count: 0,
 *   increment: () => set((state) => ({ count: state.count + 1 }))
 * }));
 *
 * // Wrap it for use with Lattice components
 * const createSlice = zustandAdapter(useStore);
 *
 * // Use in a Lattice component
 * const createComponent = (createSlice) => {
 *   const counter = createSlice(({ get }) => ({
 *     value: () => get().count,
 *     // Note: You can also use the store's methods directly
 *   }));
 *   return { counter };
 * };
 * ```
 *
 * @example With middleware
 * ```typescript
 * import { create } from 'zustand';
 * import { persist, devtools } from 'zustand/middleware';
 * import { zustandAdapter } from '@lattice/adapter-zustand';
 *
 * const useStore = create(
 *   devtools(
 *     persist(
 *       (set) => ({ count: 0, increment: () => set((s) => ({ count: s.count + 1 })) }),
 *       { name: 'app-storage' }
 *     )
 *   )
 * );
 *
 * const createSlice = zustandAdapter(useStore);
 * ```
 */
export function zustandAdapter<State>(
  store: StoreApi<State>,
  options?: ZustandAdapterOptions
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

  // Subscribe to Zustand store once
  store.subscribe(() => {
    isNotifying = true;

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

  const adapter: StoreAdapter<State> = {
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

  return createLatticeStore(adapter);
}
