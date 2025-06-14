/**
 * @fileoverview Slice-based selective subscription utilities
 *
 * This module provides utilities for subscribing to specific slice method results
 * rather than all state changes. This aligns with the principle that slices are
 * the public API and state is an implementation detail.
 *
 * Key features:
 * - Subscribe to specific slice method results
 * - Only trigger callbacks when selected values change
 * - Full TypeScript inference
 * - Custom equality functions
 * - Error handling for selector failures
 */

/**
 * A store that can be subscribed to
 */
export type SubscribableStore = {
  subscribe: (listener: () => void) => () => void;
};

/**
 * Options for subscribeToSlices
 */
export interface SubscribeOptions<T> {
  /**
   * Custom equality function to determine if selected value has changed.
   * Defaults to Object.is
   */
  equalityFn?: (a: T, b: T) => boolean;

  /**
   * Whether to fire the callback immediately with the initial value.
   * Defaults to false
   */
  fireImmediately?: boolean;

  /**
   * Whether to use React transitions for updates (React 18+).
   * When true, updates will be marked as non-urgent using startTransition.
   * Defaults to false
   */
  useTransition?: boolean;
}

/**
 * Subscribe to specific slice method results.
 *
 * This function allows you to subscribe to changes in specific slice method
 * results rather than all state changes. The callback is only triggered when
 * the selected values actually change according to the equality function.
 *
 * @param store - A store with slices and a subscribe method
 * @param selector - Function that selects values from slices
 * @param callback - Called when selected values change
 * @param options - Configuration options
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToSlices(
 *   store,
 *   (slices) => ({
 *     count: slices.counter.selector.value(),
 *     userName: slices.user.selector.name()
 *   }),
 *   ({ count, userName }) => {
 *     console.log('Values changed:', { count, userName });
 *   }
 * );
 * ```
 */
// Import startTransition if available (React 18+)
let startTransition: ((callback: () => void) => void) | undefined;
try {
  const React = require('react');
  startTransition = React.startTransition;
} catch {
  // React not available or version < 18
}

export function subscribeToSlices<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
  callback: (selected: Selected, prevSelected: Selected | undefined) => void,
  options: SubscribeOptions<Selected> = {}
): () => void {
  const {
    equalityFn = Object.is,
    fireImmediately = false,
    useTransition = false,
  } = options;

  let prevSelected: Selected | undefined;
  let isFirstRun = true;

  // Wrap callback in transition if requested and available
  const wrappedCallback =
    useTransition && startTransition
      ? (selected: Selected, prevSelected: Selected | undefined) => {
          startTransition(() => {
            callback(selected, prevSelected);
          });
        }
      : callback;

  // Run selector and check for changes
  const checkForUpdates = () => {
    try {
      const nextSelected = selector(store);

      // First run handling
      if (isFirstRun) {
        isFirstRun = false;
        prevSelected = nextSelected;
        if (fireImmediately) {
          wrappedCallback(nextSelected, undefined);
        }
        return;
      }

      // Check if values are equal
      const isEqual = equalityFn(nextSelected, prevSelected!);

      if (!isEqual) {
        const oldSelected = prevSelected;
        prevSelected = nextSelected;
        wrappedCallback(nextSelected, oldSelected);
      }
    } catch (error) {
      // If selector throws, we should handle it gracefully
      console.error('Error in subscribeToSlices selector:', error);
    }
  };

  // Subscribe to all state changes
  const unsubscribe = store.subscribe(checkForUpdates);

  // Run immediately to establish initial value
  checkForUpdates();

  return unsubscribe;
}

/**
 * Shallow equality comparison for objects.
 *
 * Useful as an equalityFn when your selector returns an object and you
 * only want to trigger updates when top-level properties change.
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if objects are shallowly equal
 *
 * @example
 * ```typescript
 * subscribeToSlices(
 *   store,
 *   (slices) => ({
 *     count: slices.counter.selector.value(),
 *     name: slices.user.selector.name()
 *   }),
 *   callback,
 *   { equalityFn: shallowEqual }
 * );
 * ```
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as any)[key], (b as any)[key])
    ) {
      return false;
    }
  }

  return true;
}
