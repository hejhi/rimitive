/**
 * @fileoverview Svelte 5 adapter for Lattice using the adapter-first API
 *
 * This provides a clean integration between Lattice and Svelte 5 runes
 * where reactive state is passed to the adapter.
 */

import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Creates a Lattice store with Svelte 5 reactive state.
 * 
 * For optimal performance, create your state using $state() runes in a .svelte.ts file
 * and pass it to this function. This allows you to use individual $state() properties
 * instead of deep proxies for better write performance.
 * 
 * @param state - The reactive state object (created with $state or plain object)
 * @returns A RuntimeSliceFactory for creating slices
 * 
 * @example
 * ```ts
 * // store.svelte.ts
 * import { createStore } from '@lattice/adapter-svelte';
 * 
 * // Option 1: Pass reactive state created with $state
 * const state = $state({ count: 0 });
 * export const createSlice = createStore(state);
 * 
 * // Option 2: For better performance with individual properties
 * class AppState {
 *   count = $state(0);
 *   user = $state({ name: 'John' });
 * }
 * const state = new AppState();
 * export const createSlice = createStore(state);
 * 
 * // Define your component
 * const createComponent = (createSlice) => {
 *   const counter = createSlice(({ get, set }) => ({
 *     value: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *   
 *   return { counter };
 * };
 * 
 * export const component = createComponent(createSlice);
 * ```
 */
export function createStore<State extends Record<string, any>>(
  state: State
): RuntimeSliceFactory<State> {
  // Create adapter that wraps the reactive state
  const adapter: StoreAdapter<State> = {
    getState: () => state,
    setState: (updates) => Object.assign(state, updates),
    subscribe: () => () => {} // Svelte handles reactivity through runes
  };

  // Return the slice factory
  return createLatticeStore(adapter);
}