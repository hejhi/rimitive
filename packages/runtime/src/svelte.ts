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

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createStore } = await import('@lattice/core');
  const { get } = await import('svelte/store');
  
  describe('Svelte runtime utilities', () => {
    // Create a test store
    const createTestStore = () => {
      const createSlice = createStore({
        count: 0,
        name: 'test',
        items: [] as string[],
      });
      
      const listeners = new Set<() => void>();
      
      const counter = createSlice(({ get, set }) => ({
        value: () => get().count,
        increment: () => {
          set({ count: get().count + 1 });
          listeners.forEach((l) => l());
        },
        doubled: () => get().count * 2,
      }));
      
      const user = createSlice(({ get, set }) => ({
        name: () => get().name,
        setName: (name: string) => {
          set({ name });
          listeners.forEach((l) => l());
        },
      }));
      
      return {
        counter,
        user,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    };
    
    describe('sliceValue', () => {
      it('should create a readable store from a selector', () => {
        const store = createTestStore();
        const count = sliceValue(store, s => s.counter.value());
        
        // Subscribe to ensure the store is active
        const values: number[] = [];
        const unsubscribe = count.subscribe(v => values.push(v));
        
        expect(values[0]).toBe(0);
        expect(get(count)).toBe(0);
        
        store.counter.increment();
        
        expect(values[1]).toBe(1);
        expect(get(count)).toBe(1);
        
        unsubscribe();
      });
      
      it('should update when store changes', () => {
        const store = createTestStore();
        const name = sliceValue(store, s => s.user.name());
        
        // Subscribe to ensure the store is active
        const values: string[] = [];
        const unsubscribe = name.subscribe(v => values.push(v));
        
        expect(values[0]).toBe('test');
        expect(get(name)).toBe('test');
        
        store.user.setName('Alice');
        
        expect(values[1]).toBe('Alice');
        expect(get(name)).toBe('Alice');
        
        unsubscribe();
      });
      
      it('should handle complex selectors', () => {
        const store = createTestStore();
        const summary = sliceValue(store, s => ({
          count: s.counter.value(),
          doubled: s.counter.doubled(),
          name: s.user.name(),
        }));
        
        // Subscribe to ensure the store is active
        const values: any[] = [];
        const unsubscribe = summary.subscribe(v => values.push(v));
        
        expect(values[0]).toEqual({
          count: 0,
          doubled: 0,
          name: 'test',
        });
        
        store.counter.increment();
        store.user.setName('Bob');
        
        expect(values[values.length - 1]).toEqual({
          count: 1,
          doubled: 2,
          name: 'Bob',
        });
        expect(get(summary)).toEqual({
          count: 1,
          doubled: 2,
          name: 'Bob',
        });
        
        unsubscribe();
      });
    });
    
    describe('sliceValues', () => {
      it('should create multiple readable stores', () => {
        const store = createTestStore();
        const values = sliceValues(store, {
          count: s => s.counter.value(),
          doubled: s => s.counter.doubled(),
          name: s => s.user.name(),
        });
        
        // Subscribe to all stores to ensure they are active
        const results: any = { count: [], doubled: [], name: [] };
        const unsubscribes = [
          values.count.subscribe(v => results.count.push(v)),
          values.doubled.subscribe(v => results.doubled.push(v)),
          values.name.subscribe(v => results.name.push(v))
        ];
        
        expect(results.count[0]).toBe(0);
        expect(results.doubled[0]).toBe(0);
        expect(results.name[0]).toBe('test');
        
        store.counter.increment();
        
        expect(results.count[1]).toBe(1);
        expect(results.doubled[1]).toBe(2);
        expect(results.name.length).toBe(1); // Name didn't change
        
        expect(get(values.count)).toBe(1);
        expect(get(values.doubled)).toBe(2);
        expect(get(values.name)).toBe('test');
        
        unsubscribes.forEach(u => u());
      });
    });
    
    describe('derivedSlice', () => {
      it('should create a derived store', () => {
        const store = createTestStore();
        const label = derivedSlice(store, s => 
          `${s.user.name()}: ${s.counter.value()}`
        );
        
        // Subscribe to ensure the store is active
        const values: string[] = [];
        const unsubscribe = label.subscribe(v => values.push(v));
        
        expect(values[0]).toBe('test: 0');
        expect(get(label)).toBe('test: 0');
        
        store.counter.increment();
        expect(values[1]).toBe('test: 1');
        expect(get(label)).toBe('test: 1');
        
        store.user.setName('Alice');
        expect(values[2]).toBe('Alice: 1');
        expect(get(label)).toBe('Alice: 1');
        
        unsubscribe();
      });
    });
    
    describe('asReadable', () => {
      it('should wrap the store as a readable', () => {
        const store = createTestStore();
        const readable = asReadable(store);
        
        const storeValue = get(readable);
        expect(storeValue).toBe(store);
        expect(storeValue.counter.value()).toBe(0);
        
        // The readable itself doesn't change, only internal state
        store.counter.increment();
        expect(get(readable)).toBe(store);
        expect(get(readable).counter.value()).toBe(1);
      });
    });
  });
}