/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management,
 * implementing the minimal adapter pattern. It creates a thin bridge
 * between Lattice components and Zustand stores.
 *
 * Key features:
 * - Minimal adapter implementation (get/set/subscribe)
 * - Uses createLatticeStore from core runtime
 * - Clean separation of concerns
 */

import type { ComponentFactory, StoreAdapter } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';
import { createStore as zustandCreateStore, StoreApi } from 'zustand/vanilla';

/**
 * Creates a Zustand adapter for a Lattice component.
 *
 * This is now a thin wrapper that:
 * 1. Creates a minimal Zustand store adapter
 * 2. Passes it to createLatticeStore
 * 
 * @param componentFactory - The Lattice component spec factory
 * @returns A Lattice store with actions, views, and subscribe
 */
export function createZustandAdapter<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>
) {
  // Create a minimal adapter
  const adapter: StoreAdapter<Model> = (() => {
    let store: StoreApi<Model>;
    
    return {
      getState: () => store ? store.getState() : ({} as Model),
      setState: (updates) => {
        if (!store) {
          // First setState call initializes the store
          store = zustandCreateStore<Model>(() => updates as Model);
        } else {
          store.setState(updates, false);
        }
      },
      subscribe: (listener) => {
        if (!store) {
          // Create empty store if subscribe is called before setState
          store = zustandCreateStore<Model>(() => ({} as Model));
        }
        return store.subscribe(listener);
      }
    };
  })();
  
  // Use the runtime to create the store
  return createLatticeStore(componentFactory, adapter);
}

/**
 * Alternative: Create adapter from existing Zustand store
 */
export function createZustandAdapterFromStore<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>,
  store: StoreApi<Model>
) {
  const adapter: StoreAdapter<Model> = {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates, false),
    subscribe: (listener) => store.subscribe(listener)
  };
  
  return createLatticeStore(componentFactory, adapter);
}