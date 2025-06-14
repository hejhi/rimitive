/**
 * @fileoverview Svelte utilities for Lattice
 *
 * This module provides Svelte-specific utilities that work with any Lattice adapter.
 * These utilities help integrate Lattice stores with Svelte's reactivity system.
 */

import { readable, derived, type Readable } from 'svelte/store';
import type { SubscribableStore } from '@lattice/core';

/**
 * Creates a Svelte readable store from a Lattice slice selector.
 * 
 * This utility bridges Lattice's subscription model with Svelte's store system,
 * enabling reactive updates in Svelte components.
 * 
 * @param store - A Lattice store with slices and subscribe method
 * @param selector - Function that selects values from slices
 * @returns A Svelte readable store with the selected value
 * 
 * @example
 * ```svelte
 * <script>
 *   import { sliceValue } from '@lattice/runtime/svelte';
 *   import { store } from './store';
 *   
 *   const count = sliceValue(store, s => s.counter.value());
 *   const user = sliceValue(store, s => s.auth.user());
 * </script>
 * 
 * <p>Count: {$count}</p>
 * {#if $user}
 *   <p>Welcome, {$user.name}!</p>
 * {/if}
 * ```
 */
export function sliceValue<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected
): Readable<Selected> {
  return readable<Selected>(selector(store), (set) => {
    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      set(selector(store));
    });
    
    // Return cleanup function
    return unsubscribe;
  });
}

/**
 * Creates multiple Svelte readable stores from slice selectors.
 * 
 * This is a convenience function for selecting multiple values at once,
 * creating a separate reactive store for each selector.
 * 
 * @param store - A Lattice store with slices and subscribe method
 * @param selectors - Object mapping keys to selector functions
 * @returns Object with same keys mapping to Svelte readable stores
 * 
 * @example
 * ```svelte
 * <script>
 *   import { sliceValues } from '@lattice/runtime/svelte';
 *   import { store } from './store';
 *   
 *   const values = sliceValues(store, {
 *     count: s => s.counter.value(),
 *     doubled: s => s.counter.doubled(),
 *     user: s => s.auth.user()
 *   });
 * </script>
 * 
 * <p>Count: {$values.count} (doubled: {$values.doubled})</p>
 * {#if $values.user}
 *   <p>Welcome, {$values.user.name}!</p>
 * {/if}
 * ```
 */
export function sliceValues<
  Component,
  Selectors extends Record<string, (slices: Component) => unknown>
>(
  store: Component & SubscribableStore,
  selectors: Selectors
): {
  [K in keyof Selectors]: Readable<ReturnType<Selectors[K]>>
} {
  const result = {} as any;
  
  for (const [key, selector] of Object.entries(selectors)) {
    result[key] = sliceValue(store, selector as any);
  }
  
  return result;
}

/**
 * Creates a derived Svelte store from multiple slice selectors.
 * 
 * This is useful when you need to combine multiple slice values into a single
 * reactive value. It uses Svelte's native `derived` store for optimal performance
 * and proper memoization.
 * 
 * @param store - A Lattice store with slices and subscribe method
 * @param selector - Function that selects and combines values from slices
 * @returns A Svelte readable store with the combined value
 * 
 * @example
 * ```svelte
 * <script>
 *   import { derivedSlice } from '@lattice/runtime/svelte';
 *   import { store } from './store';
 *   
 *   const summary = derivedSlice(store, s => ({
 *     itemCount: s.cart.items().length,
 *     totalPrice: s.cart.total(),
 *     userName: s.auth.user()?.name ?? 'Guest'
 *   }));
 * </script>
 * 
 * <p>{$summary.userName} has {$summary.itemCount} items (${$summary.totalPrice})</p>
 * ```
 */
export function derivedSlice<Component, Derived>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Derived
): Readable<Derived> {
  // Create a trigger store that updates when Lattice store changes
  const trigger = readable(0, (set) => {
    let count = 0;
    const unsubscribe = store.subscribe(() => {
      set(++count);
    });
    return unsubscribe;
  });
  
  // Use Svelte's derived for efficient computation
  // This ensures the selector only runs when the store actually changes
  // and provides proper memoization
  return derived(trigger, () => selector(store));
}

/**
 * Convenience function for accessing the entire store as a Svelte store.
 * 
 * This wraps the entire Lattice store in a Svelte readable, which can be
 * useful for passing the store through context or for debugging.
 * 
 * @param store - A Lattice store
 * @returns A Svelte readable store containing the Lattice store
 * 
 * @example
 * ```svelte
 * <script>
 *   import { getContext, setContext } from 'svelte';
 *   import { asReadable } from '@lattice/runtime/svelte';
 *   import { store } from './store';
 *   
 *   // In root component
 *   setContext('store', asReadable(store));
 *   
 *   // In child component
 *   const store = getContext('store');
 * </script>
 * ```
 */
export function asReadable<Component>(
  store: Component & SubscribableStore
): Readable<Component> {
  return readable(store, () => {
    // The store itself doesn't change, only its internal state
    // So we don't need to update the readable
    return () => {};
  });
}

// Re-export types for convenience
export type { SubscribableStore } from '@lattice/core';