/**
 * @fileoverview Svelte integration for Lattice signals-first API
 *
 * Minimal integration that leverages the fact that Lattice signals
 * already implement Svelte's store contract.
 */

import type { SliceHandle } from '@lattice/core';

/**
 * Use a Lattice slice in Svelte components.
 * 
 * Returns a store-compatible wrapper around the slice that updates when
 * any signal in the slice changes.
 *
 * @param slice - A reactive slice handle
 * @returns A Svelte store containing the slice's computed object
 *
 * @example
 * ```svelte
 * <script>
 *   import { useSlice } from '@lattice/frameworks/svelte';
 *
 *   const counter = useSlice(counterSlice);
 * </script>
 *
 * <div>Count: {$counter.value()}</div>
 * <button on:click={() => $counter.increment()}>+</button>
 * ```
 */
export function useSlice<Computed>(
  slice: SliceHandle<Computed>
): { subscribe: (fn: (value: Computed) => void) => () => void } {
  const sliceObject = slice();
  const subscribers = new Set<(value: Computed) => void>();
  const unsubscribers: (() => void)[] = [];
  
  // Find all signals in the slice and subscribe to them
  for (const key in sliceObject) {
    const value = sliceObject[key as keyof Computed];
    if (typeof value === 'function' && 'subscribe' in value && typeof (value as any).subscribe === 'function') {
      const unsubscribe = (value as any).subscribe(() => {
        // Notify all subscribers when any signal changes
        subscribers.forEach(fn => fn(slice()));
      });
      unsubscribers.push(unsubscribe);
    }
  }
  
  return {
    subscribe(fn: (value: Computed) => void) {
      subscribers.add(fn);
      fn(slice()); // Call immediately with current value
      
      return () => {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
          // Clean up signal subscriptions when no more subscribers
          unsubscribers.forEach(unsub => unsub());
        }
      };
    }
  };
}

/**
 * Create a derived value that's compatible with Svelte.
 * 
 * This is a convenience wrapper around slice selectors.
 *
 * @param slice - A reactive slice handle  
 * @param selector - Function to derive a value from the slice
 * @returns The selected value (which is a signal/store if it's reactive)
 *
 * @example
 * ```svelte
 * <script>
 *   import { useSlice, derive } from '@lattice/frameworks/svelte';
 *
 *   const counter = useSlice(counterSlice);
 *   const doubled = derive(counterSlice, c => c.doubled);
 * </script>
 *
 * <div>Doubled: {$doubled}</div>
 * ```
 */
export function derive<Computed, T>(
  slice: SliceHandle<Computed>,
  selector: (computed: Computed) => T
): T {
  return selector(slice());
}