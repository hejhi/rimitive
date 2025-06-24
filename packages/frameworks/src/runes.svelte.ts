/**
 * @fileoverview Svelte 5 Runes-Native Lattice API - Zero Overhead Reactive Slices
 *
 * This provides a runes-native API that completely bypasses Lattice's runtime layer
 * to achieve optimal performance by leveraging Svelte's built-in reactivity directly.
 *
 * Key benefits over runtime-based approach:
 * - Zero subscription overhead - uses native $derived tracking
 * - Optimal change detection - leverages Svelte's proxy-based reactivity
 * - Single reactive system - no competing reactivity layers
 * - Smaller bundle size - no runtime layer needed
 * - Better debugging - native Svelte DevTools integration
 *
 * Performance: Should match or exceed raw Svelte runes while providing
 * Lattice's compositional benefits.
 */

import type { SliceHandle } from '@lattice/core';
import { getSliceMetadata } from '@lattice/core';

/**
 * Convert a Lattice slice to a runes-compatible reactive function.
 *
 * Uses Svelte 5's $derived for zero-overhead reactivity that integrates
 * seamlessly with the runes system.
 *
 * @param sliceHandle - A Lattice slice handle
 * @param selector - Optional function to select specific values from the slice
 * @returns Function that returns the slice value or selected value
 *
 * @example
 * ```svelte
 * <script>
 *   import { slice } from '@lattice/frameworks/runes';
 *
 *   // Use entire slice - returns reactive function
 *   const counter = slice(counterSlice);
 *   const user = slice(userSlice);
 *
 *   // Use with selector for fine-grained reactivity
 *   const count = slice(counterSlice, c => c.value());
 *   const userName = slice(userSlice, u => u.name());
 *
 *   // Use in derived expressions
 *   const doubled = $derived(count() * 2);
 * </script>
 *
 * <div>Count: {count()}</div>
 * <div>User: {userName()}</div>
 * <div>Doubled: {doubled}</div>
 * <button onclick={() => counter().increment()}>+</button>
 * ```
 */
export function slice<T>(sliceHandle: SliceHandle<T>): () => T;
export function slice<T, U>(
  sliceHandle: SliceHandle<T>,
  selector: (value: T) => U
): () => U;
export function slice<T, U = T>(
  sliceHandle: SliceHandle<T>,
  selector?: (value: T) => U
): () => U {
  const actualSelector = selector || ((value: T) => value as unknown as U);

  // Use pure $derived for optimal runes performance
  // This leverages Svelte's built-in reactivity instead of manual subscriptions
  const derivedValue = $derived(actualSelector(sliceHandle()));

  return () => derivedValue;
}

/**
 * Combine multiple slice functions into a single reactive computation.
 *
 * Uses $derived for optimal dependency tracking - only recalculates when
 * any of the input slices' underlying dependencies change.
 *
 * @param slices - Object containing named slice functions to combine
 * @param combineFn - Function to combine slice values (receives object with same keys)
 * @returns Combined reactive value
 *
 * @example
 * ```svelte
 * <script>
 *   // Combines counter and user slices efficiently with named access
 *   const dashboard = combineSlices(
 *     { counter: slice(counterSlice), user: slice(userSlice), cart: slice(cartSlice) },
 *     ({ counter: counterData, user: userData, cart: cartData }) => ({
 *       greeting: `Welcome ${userData.name()}!`,
 *       stats: `${counterData.value()} clicks, ${cartData.itemCount()} items`,
 *       canCheckout: cartData.itemCount() > 0 && userData.isLoggedIn()
 *     })
 *   );
 * </script>
 *
 * <div class="dashboard">
 *   <h2>{dashboard().greeting}</h2>
 *   <p>{dashboard().stats}</p>
 *   {#if dashboard().canCheckout}
 *     <button>Checkout</button>
 *   {/if}
 * </div>
 * ```
 */
export function combineSlices<
  TSlices extends Record<string, () => any>,
  TResult,
>(
  slices: TSlices,
  combineFn: (values: {
    [K in keyof TSlices]: TSlices[K] extends () => infer C ? C : never;
  }) => TResult
): () => TResult {
  // Use $derived for fine-grained reactivity across multiple slices
  const combined = $derived(
    combineFn(
      Object.fromEntries(
        Object.entries(slices).map(([key, slice]) => [key, slice()])
      ) as {
        [K in keyof TSlices]: TSlices[K] extends () => infer C ? C : never;
      }
    )
  );

  return () => combined;
}

/**
 * Create a memoized computation that only recalculates when slice dependencies change.
 *
 * Combines Svelte's natural dependency tracking with explicit memoization for
 * expensive computations.
 *
 * @param sliceFunction - Source slice function to watch
 * @param expensiveFn - Expensive function to memoize
 * @returns Memoized reactive value
 *
 * @example
 * ```svelte
 * <script>
 *   // Only recalculates when data slice actually changes
 *   const processedData = memoized(
 *     slice(dataSlice),
 *     (d) => heavyDataProcessing(d.items())
 *   );
 *
 *   // Complex calculation that's automatically cached
 *   const fibonacci = memoized(
 *     slice(counterSlice),
 *     (c) => calculateFibonacci(c.value())
 *   );
 * </script>
 *
 * <div>Processed: {processedData().length} items</div>
 * <div>Fibonacci: {fibonacci()}</div>
 * ```
 */
export function memoized<TSlice, TResult>(
  sliceFunction: () => TSlice,
  expensiveFn: (value: TSlice) => TResult
): () => TResult {
  let cachedResult: TResult;
  let hasCache = false;
  let lastSliceValue: TSlice;

  // Create a reactive getter that handles memoization
  return () => {
    const sliceValue = sliceFunction();

    // Check if slice value has changed
    if (!hasCache || !Object.is(lastSliceValue, sliceValue)) {
      cachedResult = expensiveFn(sliceValue);
      hasCache = true;
      lastSliceValue = sliceValue;
    }

    return cachedResult;
  };
}
