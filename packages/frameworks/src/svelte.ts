/**
 * @fileoverview Svelte utilities for Lattice - Performance-first reactive stores
 * 
 * This provides Svelte stores that leverage Lattice's fine-grained reactivity
 * to eliminate unnecessary recalculations and enable performant composition.
 * 
 * Key benefits:
 * - Only updates when slice dependencies actually change
 * - Enables performant composition of complex state
 * - Native Svelte $ syntax support
 * - Async operations with built-in loading states
 * - Automatic memoization for expensive computations
 */

import { readable, type Readable } from 'svelte/store';
import { getSliceMetadata, type SliceHandle } from '@lattice/core';

// Type helper for inferring slice types
type InferSliceTypes<T extends readonly SliceHandle<any>[]> = {
  [K in keyof T]: T[K] extends SliceHandle<infer V> ? V : never
};

/**
 * Convert a Lattice slice to a Svelte store with fine-grained reactivity.
 * 
 * Unlike regular Svelte stores, this only updates when the slice's actual
 * dependencies change, not on every state mutation.
 * 
 * @param sliceHandle - A Lattice slice handle
 * @param selector - Optional function to select specific values from the slice
 * @returns Svelte readable store that updates with slice dependencies
 * 
 * @example
 * ```svelte
 * <script>
 *   import { slice } from '@lattice/frameworks/svelte';
 *   
 *   // Use entire slice
 *   const counter = slice(counterSlice);
 *   const user = slice(userSlice);
 * 
 *   // Use with selector for fine-grained reactivity  
 *   const count = slice(counterSlice, c => c.value());
 *   const userName = slice(userSlice, u => u.name());
 * </script>
 * 
 * <div>Count: {$count}</div>
 * <div>User: {$userName}</div>
 * <button on:click={() => $counter.increment()}>+</button>
 * ```
 */
export function slice<T>(sliceHandle: SliceHandle<T>): Readable<T>;
export function slice<T, U>(
  sliceHandle: SliceHandle<T>,
  selector: (value: T) => U
): Readable<U>;
export function slice<T, U = T>(
  sliceHandle: SliceHandle<T>,
  selector?: (value: T) => U
): Readable<U> {
  const actualSelector = selector || ((value: T) => value as unknown as U);
  const metadata = getSliceMetadata(sliceHandle);
  
  return readable(actualSelector(sliceHandle()), (set) => {
    if (!metadata?.subscribe) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[slice] No subscription metadata found for slice. Store will not be reactive.');
      }
      return;
    }
    
    return metadata.subscribe(() => {
      try {
        set(actualSelector(sliceHandle()));
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[slice] Error in selector function:', error);
        }
      }
    });
  });
}

/**
 * Create a derived store that only updates when slice dependencies change.
 * 
 * This is like Svelte's `derived` but with Lattice's fine-grained reactivity.
 * The function only re-runs when the slice's tracked dependencies actually change.
 * 
 * @param slice - A Lattice slice handle
 * @param fn - Function to derive new value from slice
 * @returns Svelte readable store with derived value
 * 
 * @example
 * ```svelte
 * <script>
 *   import { sliceDerived } from '@lattice/frameworks/svelte';
 *   
 *   // Only updates when counter dependencies change (not user, cart, etc.)
 *   const doubled = sliceDerived(counterSlice, c => c.value() * 2);
 *   const isEven = sliceDerived(counterSlice, c => c.value() % 2 === 0);
 * </script>
 * 
 * <div>Count doubled: {$doubled}</div>
 * <div>Is even: {$isEven}</div>
 * ```
 */
export function sliceDerived<T, U>(
  slice: SliceHandle<T>,
  fn: (value: T) => U
): Readable<U> {
  const metadata = getSliceMetadata(slice);
  
  return readable(fn(slice()), (set) => {
    if (!metadata?.subscribe) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[sliceDerived] No subscription metadata found for slice. Store will not be reactive.');
      }
      return;
    }
    
    return metadata.subscribe(() => {
      try {
        set(fn(slice()));
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[sliceDerived] Error in derived function:', error);
        }
      }
    });
  });
}

/**
 * Combine multiple slices with optimal reactivity.
 * 
 * Only recalculates when ANY of the input slices' dependencies change.
 * This enables performant composition of complex state.
 * 
 * @param slices - Array of slice handles to combine
 * @param fn - Function to combine slice values
 * @returns Svelte readable store with combined value
 * 
 * @example
 * ```svelte
 * <script>
 *   import { combineSlices } from '@lattice/frameworks/svelte';
 *   
 *   // Only updates when counter OR user changes (not cart, auth, etc.)
 *   const summary = combineSlices(
 *     [counterSlice, userSlice],
 *     (counter, user) => `${user.name()}: ${counter.value()}`
 *   );
 *   
 *   // Complex dashboard that only updates when needed
 *   const dashboard = combineSlices(
 *     [counterSlice, userSlice, cartSlice],
 *     (counter, user, cart) => ({
 *       greeting: `Welcome back, ${user.name()}!`,
 *       stats: `${counter.value()} clicks, ${cart.itemCount()} items`,
 *       isVip: user.isVip() && cart.total() > 100
 *     })
 *   );
 * </script>
 * 
 * <div class="summary">{$summary}</div>
 * <div class="dashboard">
 *   <h2>{$dashboard.greeting}</h2>
 *   <p>{$dashboard.stats}</p>
 *   {#if $dashboard.isVip}
 *     <div class="vip-badge">VIP Customer</div>
 *   {/if}
 * </div>
 * ```
 */
export function combineSlices<T extends readonly SliceHandle<any>[], U>(
  slices: T,
  fn: (...values: InferSliceTypes<T>) => U
): Readable<U> {
  const calculate = () => fn(...slices.map(s => s()) as InferSliceTypes<T>);
  
  return readable(calculate(), (set) => {
    const unsubscribes = slices.map(slice => {
      const metadata = getSliceMetadata(slice);
      if (!metadata?.subscribe) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[combineSlices] No subscription metadata found for one or more slices. Store may not be fully reactive.');
        }
        return () => {};
      }
      
      return metadata.subscribe(() => {
        try {
          set(calculate());
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[combineSlices] Error in combine function:', error);
          }
        }
      });
    });
    
    return () => unsubscribes.forEach(unsub => unsub());
  });
}

/**
 * Create async derived store with slice reactivity.
 * 
 * Automatically handles loading states and only re-runs async operations
 * when slice dependencies actually change.
 * 
 * @param slice - A Lattice slice handle
 * @param fn - Async function to derive value from slice
 * @param initial - Initial value for data
 * @returns Svelte readable store with async state
 * 
 * @example
 * ```svelte
 * <script>
 *   import { asyncDerived } from '@lattice/frameworks/svelte';
 *   
 *   // Only refetches when user slice dependencies change
 *   const userData = asyncDerived(userSlice, async user => {
 *     const response = await fetch(`/api/users/${user.id()}`);
 *     return response.json();
 *   });
 *   
 *   // Search results that update when search slice changes
 *   const searchResults = asyncDerived(searchSlice, async search => {
 *     const response = await fetch(`/api/search?q=${search.query()}`);
 *     return response.json();
 *   }, []);
 * </script>
 * 
 * <div class="user">
 *   {#if $userData.loading}
 *     Loading user data...
 *   {:else if $userData.error}
 *     Error: {$userData.error.message}
 *   {:else if $userData.data}
 *     Email: {$userData.data.email}
 *   {/if}
 * </div>
 * 
 * <div class="search">
 *   {#if $searchResults.loading}
 *     Searching...
 *   {:else}
 *     {#each $searchResults.data as result}
 *       <div>{result.title}</div>
 *     {/each}
 *   {/if}
 * </div>
 * ```
 */
export function asyncDerived<T, U>(
  slice: SliceHandle<T>,
  fn: (value: T) => Promise<U>,
  initial?: U
): Readable<{ data: U | undefined; loading: boolean; error: Error | null }> {
  const metadata = getSliceMetadata(slice);
  
  return readable(
    { data: initial, loading: false, error: null } as { data: U | undefined; loading: boolean; error: Error | null },
    (set) => {
      if (!metadata?.subscribe) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[asyncDerived] No subscription metadata found for slice. Store will not be reactive.');
        }
        return;
      }
      
      let cancelled = false;
      
      const runAsync = async () => {
        set({ data: initial, loading: true, error: null } as any);
        
        try {
          const result = await fn(slice());
          if (!cancelled) {
            set({ data: result, loading: false, error: null });
          }
        } catch (error) {
          if (!cancelled) {
            set({ data: initial, loading: false, error: error as Error } as any);
          }
        }
      };
      
      // Run initially
      runAsync();
      
      // Subscribe to slice changes
      const unsubscribe = metadata.subscribe(() => {
        runAsync();
      });
      
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }
  );
}

/**
 * Create memoized store for expensive computations.
 * 
 * Combines Lattice's fine-grained reactivity with automatic memoization.
 * The expensive function only re-runs when the slice's dependencies change.
 * 
 * @param slice - A Lattice slice handle
 * @param fn - Expensive function to memoize
 * @returns Svelte readable store with memoized computation
 * 
 * @example
 * ```svelte
 * <script>
 *   import { memoized } from '@lattice/frameworks/svelte';
 *   
 *   // Expensive computation that's memoized
 *   const fibonacci = memoized(
 *     counterSlice,
 *     counter => expensiveFibonacci(counter.value())
 *   );
 *   
 *   // Heavy data processing with automatic cache invalidation
 *   const processedData = memoized(
 *     dataSlice,
 *     data => heavyDataProcessing(data.items())
 *   );
 * </script>
 * 
 * <div class="expensive">
 *   Fibonacci: {$fibonacci}
 * </div>
 * 
 * <div class="processed">
 *   {#each $processedData as item}
 *     <div>{item.processed}</div>
 *   {/each}
 * </div>
 * ```
 */
export function memoized<T, U>(
  slice: SliceHandle<T>,
  fn: (value: T) => U
): Readable<U> {
  // Simple memoization: cache until slice dependencies change
  let cachedResult: U | undefined;
  let hasCache = false;
  
  const compute = (): U => {
    if (hasCache && cachedResult !== undefined) {
      return cachedResult;
    }
    
    const result = fn(slice());
    cachedResult = result;
    hasCache = true;
    return result;
  };
  
  const metadata = getSliceMetadata(slice);
  
  return readable(compute(), (set) => {
    if (!metadata?.subscribe) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[memoized] No subscription metadata found for slice. Store will not be reactive.');
      }
      return;
    }
    
    return metadata.subscribe(() => {
      // When slice dependencies change, invalidate cache and recompute
      hasCache = false;
      set(compute());
    });
  });
}

