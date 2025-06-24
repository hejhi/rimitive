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

import type { StoreAdapter, SliceHandle } from '@lattice/core';

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

  // For runes, we create a $derived value that tracks slice changes
  const derivedValue = $derived(actualSelector(sliceHandle()));

  // Return a function that accesses the derived value
  return () => derivedValue;
}

/**
 * Actions interface for state mutations
 */
export interface RunesActions<State> {
  /**
   * Update a specific key in the state
   */
  set<K extends keyof State>(key: K, value: State[K]): void;

  /**
   * Update multiple keys in the state
   */
  update(updates: Partial<State>): void;

  /**
   * Apply a function to transform the current state
   */
  transform(fn: (current: State) => Partial<State>): void;
}

/**
 * Slice function type - returns computed values and actions
 */
export type RunesSlice<TComputed> = () => TComputed;

/**
 * Create a runes-native slice factory that uses $state and $derived directly.
 *
 * This completely bypasses Lattice's runtime layer and uses pure Svelte reactivity
 * for optimal performance. The API maintains Lattice's familiar patterns while
 * achieving zero overhead.
 *
 * @param initialState - Initial state object that becomes reactive via $state
 * @returns A slice factory function
 *
 */
export function createSvelteSlices<State extends Record<string, any>>(
  initialState: State
) {
  // Create reactive state using $state - this is the single source of truth
  const state = $state(initialState);

  // Create actions for state mutations
  function createActions(): RunesActions<State> {
    return {
      set<K extends keyof State>(key: K, value: State[K]) {
        state[key] = value;
        void 0; // Discard assignment return value
      },

      update(updates: Partial<State>) {
        for (const key in updates) {
          const value = updates[key];
          if (value !== undefined) {
            state[key] = value;
            void 0; // Discard assignment return value
          }
        }
      },

      transform(fn: (current: State) => Partial<State>) {
        const updates = fn(state);
        for (const key in updates) {
          const value = updates[key];
          if (value !== undefined) {
            state[key] = value;
            void 0; // Discard assignment return value
          }
        }
      },
    };
  }

  const actions = createActions();

  /**
   * Create a reactive slice with fine-grained dependency tracking.
   *
   * Uses $derived internally for optimal Svelte reactivity - only recomputes
   * when the specific state properties accessed in depsSelector actually change.
   *
   * @param depsSelector - Function to select dependencies from state
   * @param computeSlice - Function to create computed values and actions from dependencies
   * @returns Reactive slice function
   */
  return function createSlice<TDeps, TComputed>(
    depsSelector: (state: State) => TDeps,
    computeSlice: (deps: TDeps, actions: RunesActions<State>) => TComputed
  ): RunesSlice<TComputed> {
    // Create derived value at slice creation time (not on each call)
    const slice = $derived(computeSlice(depsSelector(state), actions));

    // Return function that accesses the derived value
    return () => slice;
  };
}

/**
 * Combine multiple runes-based slices into a single reactive computation.
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
 *     { counter, user, cart },
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
  TSlices extends Record<string, RunesSlice<any>>,
  TResult,
>(
  slices: TSlices,
  combineFn: (values: {
    [K in keyof TSlices]: TSlices[K] extends RunesSlice<infer C> ? C : never;
  }) => TResult
): () => TResult {
  // Use $derived for fine-grained reactivity across multiple slices
  const combined = $derived(
    combineFn(
      Object.fromEntries(
        Object.entries(slices).map(([key, slice]) => [key, slice()])
      ) as {
        [K in keyof TSlices]: TSlices[K] extends RunesSlice<infer C>
          ? C
          : never;
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
 * @param slice - Source slice to watch
 * @param expensiveFn - Expensive function to memoize
 * @returns Memoized reactive value
 *
 * @example
 * ```svelte
 * <script>
 *   // Only recalculates when data slice actually changes
 *   const processedData = memoized(
 *     data,
 *     (d) => heavyDataProcessing(d.items())
 *   );
 *
 *   // Complex calculation that's automatically cached
 *   const fibonacci = memoized(
 *     counter,
 *     (c) => calculateFibonacci(c.value())
 *   );
 * </script>
 *
 * <div>Processed: {processedData().length} items</div>
 * <div>Fibonacci: {fibonacci()}</div>
 * ```
 */
export function memoized<TSlice, TResult>(
  slice: RunesSlice<TSlice>,
  expensiveFn: (value: TSlice) => TResult
): () => TResult {
  let cachedResult: TResult;
  let hasCache = false;
  let lastSliceValue: TSlice;

  // Create a reactive getter that handles memoization
  return () => {
    const sliceValue = slice();

    // Check if slice value has changed
    if (!hasCache || !Object.is(lastSliceValue, sliceValue)) {
      cachedResult = expensiveFn(sliceValue);
      hasCache = true;
      lastSliceValue = sliceValue;
    }

    return cachedResult;
  };
}

/**
 * Create a Lattice StoreAdapter that uses Svelte 5 runes as the underlying reactive primitive.
 *
 * This allows you to use Lattice's runtime system with runes-based state, providing
 * a bridge between the runtime approach and runes-native approach.
 *
 * @param runesState - Reactive state object created with $state
 * @returns StoreAdapter that can be used with createLatticeStore
 *
 * @example
 * ```svelte
 * <script>
 *   import { createLatticeStore } from '@lattice/core';
 *   import { svelteRunesAdapter } from '@lattice/frameworks/runes';
 *
 *   // Create runes-based state
 *   const state = $state({
 *     count: 0,
 *     user: { name: 'Alice', email: 'alice@example.com' }
 *   });
 *
 *   // Use with Lattice runtime system
 *   const adapter = svelteRunesAdapter(state);
 *   const createSlice = createLatticeStore(adapter);
 *
 *   // Create slices using runtime API
 *   const counter = createSlice(
 *     (selectors) => ({ count: selectors.count }),
 *     ({ count }, set) => ({
 *       value: () => count(),
 *       increment: () => set(({ count }) => ({ count: count() + 1 }))
 *     })
 *   );
 * </script>
 *
 * <div>Count: {counter().value()}</div>
 * <button onclick={() => counter().increment()}>+</button>
 * ```
 */
export function svelteRunesAdapter<State extends Record<string, unknown>>(
  runesState: State
): StoreAdapter<State> {
  const listeners = new Set<() => void>();

  return {
    getState: () => runesState,
    setState: (updates: Partial<State>) => {
      for (const key in updates) {
        const value = updates[key];
        if (value !== undefined) {
          // Use separate assignment to avoid expression evaluation warning
          const state = runesState as any;
          state[key] = value;
          void 0; // Discard assignment return value
        }
      }

      // Notify all listeners of the state change
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
