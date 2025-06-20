/**
 * @fileoverview React hooks for Lattice
 *
 * This module provides React hooks that work with the new reactive slice API,
 * enabling fine-grained reactive component updates.
 *
 * Key features:
 * - Slice handle subscriptions with useSliceSelector
 * - Fine-grained dependency tracking
 * - Full TypeScript support with proper inference
 * - Optimized re-renders based on slice dependencies
 */

import {
  useRef,
  useCallback,
  useSyncExternalStore,
  useEffect,
  useReducer,
} from 'react';
import type { SliceHandle } from '@lattice/core';
import { getSliceMetadata } from '@lattice/core';

/**
 * Shallow equality comparison for objects
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.is((a as any)[key], (b as any)[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * React hook for using reactive slices.
 *
 * This hook provides access to slice values and methods, with optional
 * selection for fine-grained reactivity.
 *
 * @param slice - A reactive slice handle
 * @param selector - Optional function to select specific values from the slice
 * @param equalityFn - Optional custom equality function (defaults to Object.is)
 * @returns The slice computed values or selected values
 *
 * @example
 * ```tsx
 * // Use entire slice (re-renders on any change)
 * function Counter() {
 *   const counter = useSlice(counterSlice);
 *   return (
 *     <button onClick={counter.increment}>
 *       Count: {counter.value()}
 *     </button>
 *   );
 * }
 * 
 * // Use with selector (re-renders only when selected value changes)
 * function CountDisplay() {
 *   const count = useSlice(counterSlice, c => c.value());
 *   return <div>Count: {count}</div>;
 * }
 * ```
 */
export function useSlice<Computed>(
  slice: SliceHandle<Computed>
): Computed;
export function useSlice<Computed, Selected>(
  slice: SliceHandle<Computed>,
  selector: (computed: Computed) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean
): Selected;
export function useSlice<Computed, Selected = Computed>(
  slice: SliceHandle<Computed>,
  selector?: (computed: Computed) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean
): Selected {
  // Get slice metadata for subscription
  const metadata = getSliceMetadata(slice);
  if (!metadata) {
    throw new Error('Invalid slice: missing metadata');
  }

  // If no selector provided, return the entire computed object
  const computedSelector = selector || ((computed: Computed) => computed as unknown as Selected);

  // Store the selector and equality function in refs
  const selectorRef = useRef(computedSelector);
  selectorRef.current = computedSelector;

  const equalityFnRef = useRef(equalityFn);
  equalityFnRef.current = equalityFn;

  // Initialize and store the current selected value
  const selectedValueRef = useRef<Selected>();
  const getSnapshotRef = useRef<() => Selected>();

  // Lazy initialization pattern for better performance
  if (!getSnapshotRef.current) {
    const computed = slice();
    selectedValueRef.current = computedSelector(computed);
    getSnapshotRef.current = () => selectedValueRef.current!;
  }

  // Create stable callbacks for useSyncExternalStore
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return metadata.subscribe(() => {
        const computed = slice();
        const nextValue = selectorRef.current(computed);
        const currentValue = selectedValueRef.current!;

        // Direct equality check without ternary
        const isEqual =
          equalityFnRef.current?.(currentValue, nextValue) ??
          Object.is(currentValue, nextValue);

        if (!isEqual) {
          selectedValueRef.current = nextValue;
          onStoreChange();
        }
      });
    },
    [metadata, slice]
  );

  // Stable getSnapshot using ref
  const getSnapshot = getSnapshotRef.current!;

  // Memoize getServerSnapshot
  const getServerSnapshot = useCallback(
    () => {
      const computed = slice();
      return computedSelector(computed);
    },
    [slice, computedSelector]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}


/**
 * Hook for using multiple slices with a combined selector.
 *
 * This hook allows selecting values from multiple slices in a single call,
 * optimized with shallow equality by default.
 *
 * @param slices - Object mapping keys to [slice, selector] tuples
 * @returns Object with selected values
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const data = useSlices({
 *     count: [counterSlice, c => c.value()],
 *     user: [userSlice, u => ({ name: u.name(), email: u.email() })],
 *     cartTotal: [cartSlice, c => c.total()]
 *   });
 *
 *   return <div>{data.user.name}: {data.count} items, ${data.cartTotal}</div>;
 * }
 * ```
 */
export function useSlices<
  T extends Record<string, [SliceHandle<any>, (computed: any) => any]>
>(
  slices: T
): {
  [K in keyof T]: T[K] extends [SliceHandle<any>, (computed: any) => infer R] ? R : never
} {
  // Store previous values for comparison
  const prevValuesRef = useRef<Record<string, any>>({});
  const forceUpdate = useReducer((x) => x + 1, 0)[1];

  // Subscribe to all slices
  useEffect(() => {
    const unsubscribes: Array<() => void> = [];

    for (const [key, [slice, selector]] of Object.entries(slices)) {
      const metadata = getSliceMetadata(slice);
      if (!metadata) continue;

      const unsubscribe = metadata.subscribe(() => {
        const computed = slice();
        const newValue = selector(computed);
        
        if (!shallowEqual(prevValuesRef.current[key], newValue)) {
          prevValuesRef.current[key] = newValue;
          forceUpdate();
        }
      });
      
      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [slices]);

  // Build result object
  const result: any = {};
  for (const [key, [slice, selector]] of Object.entries(slices)) {
    const computed = slice();
    result[key] = selector(computed);
    prevValuesRef.current[key] = result[key];
  }

  return result;
}

