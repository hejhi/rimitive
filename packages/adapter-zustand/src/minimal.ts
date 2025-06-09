/**
 * @fileoverview Minimal Zustand adapter for Lattice
 * 
 * This is a proof of concept for the new minimal adapter pattern.
 * Adapters only need to provide get/set/subscribe primitives.
 */

import { createStore, StoreApi } from 'zustand/vanilla';
import type { StoreAdapter } from '@lattice/core';

/**
 * Creates a minimal Zustand adapter
 * 
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createMinimalZustandAdapter<Model>(
  initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create the Zustand store with a simple state container
  const store = createStore<Model>((set) => ({
    ...initialState
  } as Model));
  
  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates, false),
    subscribe: (listener) => store.subscribe(listener)
  };
}

/**
 * Alternative: Wrap an existing Zustand store as a minimal adapter
 */
export function wrapZustandStore<Model>(
  store: StoreApi<Model>
): StoreAdapter<Model> {
  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates, false),
    subscribe: (listener) => store.subscribe(listener)
  };
}