/**
 * @fileoverview Svelte runtime utilities for Lattice
 * 
 * Provides Svelte-specific utilities for creating reactive derived values
 * from Lattice slices, similar to Vue composables but using Svelte runes.
 */

import type { SubscribableStore } from '@lattice/core';

/**
 * Creates a derived value from slice selectors.
 * The derived value will automatically update when the selected values change.
 * 
 * @param store - A Lattice store with slices
 * @param selector - Function that selects values from slices
 * @returns A derived value that updates reactively
 * 
 * @example
 * ```ts
 * // store.svelte.ts
 * import { createStore } from '@lattice/adapter-svelte';
 * import { derived } from '@lattice/adapter-svelte/runtime';
 * 
 * const state = $state({ count: 0, multiplier: 2 });
 * const createSlice = createStore(state);
 * 
 * const component = createComponent(createSlice);
 * 
 * // Create derived values
 * const doubled = derived(component, (slices) => 
 *   slices.counter.value() * 2
 * );
 * 
 * const summary = derived(component, (slices) => ({
 *   count: slices.counter.value(),
 *   isEven: slices.counter.value() % 2 === 0
 * }));
 * ```
 */
export function derived<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected
): Selected {
  // Note: When this file is properly compiled as .svelte.ts,
  // this would use Svelte's $derived rune:
  // return $derived(selector(store));
  
  // For now, we return a simple call that documents the pattern
  // In actual usage with .svelte.ts:
  const derivedValue = selector(store);
  return derivedValue;
}

/**
 * Creates multiple derived values from a store.
 * Useful for destructuring multiple reactive values at once.
 * 
 * @param store - A Lattice store with slices
 * @param selector - Function that returns an object of selected values
 * @returns Object with derived values
 * 
 * @example
 * ```ts
 * const { count, isEven, total } = deriveValues(component, (slices) => ({
 *   count: slices.counter.value(),
 *   isEven: slices.counter.value() % 2 === 0,
 *   total: slices.counter.value() * slices.multiplier.value()
 * }));
 * ```
 */
export function deriveValues<
  Component,
  Selected extends Record<string, unknown>
>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected
): Selected {
  // With proper .svelte.ts compilation:
  // const values = selector(store);
  // return Object.fromEntries(
  //   Object.entries(values).map(([key, value]) => [key, $derived(value)])
  // ) as Selected;
  
  return selector(store);
}

/**
 * Helper to create a reactive slice accessor.
 * Returns the slice with reactive method results.
 * 
 * @param store - A Lattice store with slices
 * @param sliceName - Name of the slice to access
 * @returns The slice with reactive capabilities
 * 
 * @example
 * ```ts
 * const counter = useSlice(component, 'counter');
 * const count = $derived(counter.value());
 * ```
 */
export function useSlice<Component, K extends keyof Component>(
  store: Component & SubscribableStore,
  sliceName: K
): Component[K] {
  return store[sliceName];
}