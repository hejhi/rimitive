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
 *     count: slices.counter.value(),
 *     userName: slices.user.name()
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
 *     count: slices.counter.value(),
 *     name: slices.user.name()
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

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  describe('subscribeToSlices', () => {
    // Create a simple test store
    const createTestStore = (initialState = { count: 0, name: 'test' }) => {
      let state = initialState;
      const listeners = new Set<() => void>();

      const store = {
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        counter: {
          value: () => state.count,
          increment: () => {
            state = { ...state, count: state.count + 1 };
            listeners.forEach((l) => l());
          },
        },
        user: {
          name: () => state.name,
          setName: (name: string) => {
            state = { ...state, name };
            listeners.forEach((l) => l());
          },
        },
      };

      return store;
    };

    it('should only call callback when selected values change', () => {
      const store = createTestStore();
      const callback = vi.fn();

      const unsubscribe = subscribeToSlices(
        store,
        (s) => s.counter.value(),
        callback
      );

      // Callback should not be called on subscription
      expect(callback).not.toHaveBeenCalled();

      // Change unrelated state
      store.user.setName('new name');
      expect(callback).not.toHaveBeenCalled();

      // Change selected state
      store.counter.increment();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1, 0);

      unsubscribe();
    });

    it('should support selecting multiple values', () => {
      const store = createTestStore();
      const callback = vi.fn();

      subscribeToSlices(
        store,
        (s) => ({
          count: s.counter.value(),
          name: s.user.name(),
        }),
        callback
      );

      store.counter.increment();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { count: 1, name: 'test' },
        { count: 0, name: 'test' }
      );

      store.user.setName('alice');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(
        { count: 1, name: 'alice' },
        { count: 1, name: 'test' }
      );
    });

    it('should support fireImmediately option', () => {
      const store = createTestStore();
      const callback = vi.fn();

      subscribeToSlices(store, (s) => s.counter.value(), callback, {
        fireImmediately: true,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(0, undefined);
    });

    it('should handle selector errors gracefully', () => {
      const store = createTestStore();
      const callback = vi.fn();
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      subscribeToSlices(
        store,
        () => {
          throw new Error('Selector error');
        },
        callback
      );

      expect(callback).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Error in subscribeToSlices selector:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should use custom equality function', () => {
      const store = createTestStore({ count: 1, name: 'test' });
      const callback = vi.fn();

      // Only care about count changes > 5
      const customEqual = (a: number, b: number) => Math.abs(a - b) < 5;

      subscribeToSlices(store, (s) => s.counter.value(), callback, {
        equalityFn: customEqual,
      });

      // Small changes should not trigger callback
      store.counter.increment(); // 2
      store.counter.increment(); // 3
      store.counter.increment(); // 4
      expect(callback).not.toHaveBeenCalled();

      // Large change should trigger
      store.counter.increment(); // 5
      store.counter.increment(); // 6
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(6, 1);
    });
  });

  describe('shallowEqual', () => {
    it('should return true for identical values', () => {
      const obj = { a: 1 };
      expect(shallowEqual(obj, obj)).toBe(true);
      expect(shallowEqual(1, 1)).toBe(true);
      expect(shallowEqual('test', 'test')).toBe(true);
      expect(shallowEqual(null, null)).toBe(true);
      expect(shallowEqual(undefined, undefined)).toBe(true);
    });

    it('should return true for shallowly equal objects', () => {
      expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(shallowEqual({}, {})).toBe(true);
    });

    it('should return false for different values', () => {
      expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
      expect(shallowEqual(1, 2)).toBe(false);
      expect(shallowEqual('a', 'b')).toBe(false);
      expect(shallowEqual(null, undefined)).toBe(false);
    });

    it('should return false for deeply different objects', () => {
      const obj1 = { a: { b: 1 } };
      const obj2 = { a: { b: 1 } };
      expect(shallowEqual(obj1, obj2)).toBe(false); // Different object references
    });
  });
}
