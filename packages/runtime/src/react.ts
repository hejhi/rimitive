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
  startTransition,
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
 * React hook for subscribing to reactive slice values.
 *
 * This hook will re-render the component only when the selected values
 * change according to the equality function.
 *
 * @param slice - A reactive slice handle
 * @param selector - Function that selects values from the slice
 * @param equalityFn - Optional custom equality function (defaults to Object.is)
 * @returns The selected values
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const { count, isEven } = useSliceSelector(counterSlice, (counter) => ({
 *     count: counter.value(),
 *     isEven: counter.isEven()
 *   }));
 *
 *   return <div>Count: {count} (even: {isEven})</div>;
 * }
 * ```
 */
export function useSliceSelector<Computed, Selected>(
  slice: SliceHandle<Computed>,
  selector: (computed: Computed) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean,
  useTransitions = false
): Selected {
  // Get slice metadata for subscription
  const metadata = getSliceMetadata(slice);
  if (!metadata) {
    throw new Error('Invalid slice: missing metadata');
  }

  // Store the selector and equality function in refs
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const equalityFnRef = useRef(equalityFn);
  equalityFnRef.current = equalityFn;

  // Initialize and store the current selected value
  const selectedValueRef = useRef<Selected>();
  const getSnapshotRef = useRef<() => Selected>();

  // Lazy initialization pattern for better performance
  if (!getSnapshotRef.current) {
    const computed = slice();
    selectedValueRef.current = selector(computed);
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
          if (useTransitions) {
            startTransition(onStoreChange);
          } else {
            onStoreChange();
          }
        }
      });
    },
    [metadata, slice, useTransitions]
  );

  // Stable getSnapshot using ref
  const getSnapshot = getSnapshotRef.current!;

  // Memoize getServerSnapshot
  const getServerSnapshot = useCallback(
    () => {
      const computed = slice();
      return selector(computed);
    },
    [slice, selector]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenience hook for accessing a single slice.
 *
 * This is a simpler alternative to useSliceSelector when you just need
 * to access all methods from a single slice.
 *
 * @param store - A Lattice store with slices
 * @param sliceName - The name of the slice to access
 * @returns The slice object
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const counter = useSlice(store, 'counter');
 *
 *   return (
 *     <button onClick={counter.increment}>
 *       Count: {counter.value()}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSlice<Component, K extends keyof Component>(
  store: Component & SubscribableStore,
  sliceName: K
): Component[K] {
  // For a single slice, we can just return it directly since
  // slice objects themselves are stable
  return store[sliceName];
}

/**
 * Hook for subscribing to multiple slice values with shallow equality.
 *
 * This is optimized for selecting multiple primitive values from different
 * slices. It uses shallow equality by default to prevent unnecessary
 * re-renders when selecting objects.
 *
 * @param store - A Lattice store with slices
 * @param selector - Function that selects values from slices
 * @returns The selected values
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const data = useSliceValues(store, (slices) => ({
 *     name: slices.user.name(),
 *     email: slices.user.email(),
 *     isLoggedIn: slices.auth.isAuthenticated(),
 *     itemCount: slices.cart.itemCount()
 *   }));
 *
 *   return <div>Welcome {data.name}!</div>;
 * }
 * ```
 */
export function useSliceValues<
  Component,
  Selected extends Record<string, unknown>,
>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
  useTransitions = false
): Selected {
  return useSliceSelector(store, selector, shallowEqual, useTransitions);
}

/**
 * Hook that provides both slice values and the full store for actions.
 *
 * This is useful when you need to both read values and call actions
 * in the same component.
 *
 * @param store - A Lattice store with slices
 * @param selector - Function that selects values from slices
 * @param equalityFn - Optional custom equality function
 * @returns Object with selected values and slices
 *
 * @example
 * ```tsx
 * function TodoItem({ id }) {
 *   const { values, slices } = useLattice(store, (s) => ({
 *     todo: s.todos.getById(id),
 *     isEditing: s.ui.isEditing(id)
 *   }));
 *
 *   return (
 *     <div>
 *       <span>{values.todo.text}</span>
 *       <button onClick={() => slices.todos.remove(id)}>
 *         Delete
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLattice<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean,
  useTransitions = false
): {
  values: Selected;
  slices: Component;
} {
  const values = useSliceSelector(store, selector, equalityFn, useTransitions);

  // Use a single ref for the result object and update it only when values change
  const resultRef = useRef<{ values: Selected; slices: Component }>();

  // Lazy initialization for the result object
  if (!resultRef.current) {
    resultRef.current = { values, slices: store };
  } else if (resultRef.current.values !== values) {
    // Only update when values actually change
    resultRef.current.values = values;
  }

  return resultRef.current;
}
