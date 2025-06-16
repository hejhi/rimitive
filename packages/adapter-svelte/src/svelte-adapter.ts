/**
 * @fileoverview Svelte 5 adapter for Lattice using the adapter-first API
 *
 * This provides a clean integration between Lattice and Svelte 5 runes
 * where reactive state is passed to the adapter.
 */

import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Creates a Lattice store from Svelte reactive state.
 * 
 * @param state - The reactive state created with Svelte runes
 * @returns A RuntimeSliceFactory for creating slices
 * 
 * @example
 * ```ts
 * // store.svelte.ts
 * import { createStore } from '@lattice/adapter-svelte';
 * 
 * // Create reactive state with Svelte runes
 * const state = $state({ count: 0 });
 * 
 * // Create the slice factory
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
 * export { state }; // Export state for use in templates
 * ```
 * 
 * Then in your Svelte component:
 * ```svelte
 * <script>
 * import { state, component } from './store.svelte';
 * </script>
 * 
 * <p>Count: {state.count}</p>
 * <button onclick={() => component.counter.selector.increment()}>+</button>
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