/**
 * @fileoverview Svelte integration for Lattice signals-first API
 *
 * Minimal integration that leverages the fact that Lattice signals
 * already implement Svelte's store contract.
 */

import type { Signal, Computed } from '@lattice/core';
import type { Readable } from 'svelte/store';

/**
 * Check if a value is a signal or computed (has subscribe method)
 */
function isSignal(value: unknown): value is Signal<unknown> | Computed<unknown> {
  return typeof value === 'function' && 
         value !== null &&
         'subscribe' in value &&
         typeof value.subscribe === 'function';
}

/**
 * Use a Lattice store in Svelte components.
 * 
 * Returns a store-compatible wrapper that updates when
 * any signal in the store changes.
 *
 * @param store - A Lattice store
 * @returns A Svelte store containing the store object
 *
 * @example
 * ```svelte
 * <script>
 *   import { useStore } from '@lattice/frameworks/svelte';
 *   import { counterStore } from './stores';
 *
 *   const counter = useStore(counterStore);
 * </script>
 *
 * <div>Count: {$counter.value()}</div>
 * <button on:click={() => $counter.increment()}>+</button>
 * ```
 */
export function useStore<T extends Record<string, any>>(
  store: T
): Readable<T> {
  const subscribers = new Set<(value: T) => void>();
  let unsubscribers: (() => void)[] = [];
  
  function setupSubscriptions() {
    // Clean up existing subscriptions
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
    
    // Check if store has _subscribe method - use that instead of individual signals
    if (store !== null && 
        typeof store === 'object' && 
        '_subscribe' in store && 
        typeof store._subscribe === 'function') {
      const unsubscribe = store._subscribe(() => {
        subscribers.forEach(fn => fn(store));
      });
      unsubscribers.push(unsubscribe);
    } else {
      // Fall back to subscribing to individual signals
      for (const key in store) {
        const value = store[key];
        if (isSignal(value)) {
          const unsubscribe = value.subscribe(() => {
            // Notify all subscribers when any signal changes
            subscribers.forEach(fn => fn(store));
          });
          unsubscribers.push(unsubscribe);
        }
      }
    }
  }
  
  return {
    subscribe(fn: (value: T) => void) {
      if (subscribers.size === 0) {
        setupSubscriptions();
      }
      
      subscribers.add(fn);
      fn(store); // Call immediately with current value
      
      return () => {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
          // Clean up signal subscriptions when no more subscribers
          unsubscribers.forEach(unsub => unsub());
          unsubscribers = [];
        }
      };
    }
  };
}

/**
 * Direct access to signals - they already implement Svelte's store contract
 *
 * @param signal - A Lattice signal or computed
 * @returns The signal itself (it's already a Svelte store)
 *
 * @example
 * ```svelte
 * <script>
 *   import { useSignal } from '@lattice/frameworks/svelte';
 *   import { counterStore } from './stores';
 *
 *   const count = useSignal(counterStore.value);
 * </script>
 *
 * <div>Count: {$count}</div>
 * ```
 */
export function useSignal<T>(signal: Signal<T> | Computed<T>): Readable<T> {
  // Create a Svelte-compatible store from the signal
  return {
    subscribe(run: (value: T) => void, _invalidate?: () => void) {
      // Initial value
      run(signal());
      
      // Subscribe to changes
      const unsubscribe = signal.subscribe(() => {
        run(signal());
      });
      
      return unsubscribe;
    }
  };
}