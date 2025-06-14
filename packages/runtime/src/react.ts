/**
 * @fileoverview React hooks for Lattice
 *
 * This module provides React hooks that work with any Lattice adapter,
 * enabling reactive component updates based on slice method results.
 *
 * Key features:
 * - Slice-based subscriptions with useSliceSelector
 * - Convenience hooks for common patterns
 * - Full TypeScript support with proper inference
 * - Optimized re-renders based on slice method results
 */

import {
  useRef,
  useCallback,
  useSyncExternalStore,
  startTransition,
} from 'react';
import {
  subscribeToSlices,
  shallowEqual,
  injectStartTransition,
  type SubscribableStore,
} from '@lattice/core';

// Inject React 18's startTransition into core if available
if (startTransition) {
  injectStartTransition(startTransition);
}

/**
 * React hook for subscribing to specific slice method results.
 *
 * This hook will re-render the component only when the selected values
 * change according to the equality function.
 *
 * @param store - A Lattice store with slices and subscribe method
 * @param selector - Function that selects values from slices
 * @param equalityFn - Optional custom equality function (defaults to Object.is)
 * @returns The selected values
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const { count, isEven } = useSliceSelector(store, (slices) => ({
 *     count: slices.counter.value(),
 *     isEven: slices.counter.isEven()
 *   }));
 *
 *   return <div>Count: {count} (even: {isEven})</div>;
 * }
 * ```
 */
export function useSliceSelector<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean,
  useTransitions = false
): Selected {
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
    selectedValueRef.current = selector(store);
    getSnapshotRef.current = () => selectedValueRef.current!;
  }

  // Create stable callbacks for useSyncExternalStore
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return subscribeToSlices(
        store,
        (slices) => {
          const nextValue = selectorRef.current(slices);
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
          return nextValue;
        },
        () => {}, // Empty callback since we handle the change detection above
        { fireImmediately: false }
      );
    },
    [store, useTransitions]
  );

  // Stable getSnapshot using ref
  const getSnapshot = getSnapshotRef.current!;

  // Memoize getServerSnapshot
  const getServerSnapshot = useCallback(
    () => selector(store),
    [store, selector]
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
