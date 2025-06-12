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
  type SubscribableStore,
} from '@lattice/core';

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
export function useSliceSelector<App, Selected>(
  store: App & SubscribableStore,
  selector: (slices: App) => Selected,
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
export function useSlice<App, K extends keyof App>(
  store: App & SubscribableStore,
  sliceName: K
): App[K] {
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
export function useSliceValues<App, Selected extends Record<string, unknown>>(
  store: App & SubscribableStore,
  selector: (slices: App) => Selected,
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
export function useLattice<App, Selected>(
  store: App & SubscribableStore,
  selector: (slices: App) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean,
  useTransitions = false
): {
  values: Selected;
  slices: App;
} {
  const values = useSliceSelector(store, selector, equalityFn, useTransitions);

  // Use a single ref for the result object and update it only when values change
  const resultRef = useRef<{ values: Selected; slices: App }>();

  // Lazy initialization for the result object
  if (!resultRef.current) {
    resultRef.current = { values, slices: store };
  } else if (resultRef.current.values !== values) {
    // Only update when values actually change
    resultRef.current.values = values;
  }

  return resultRef.current;
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { renderHook, act } = await import('@testing-library/react');
  const { createStore } = await import('@lattice/core');

  describe('React hooks', () => {
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
        isEven: () => get().count % 2 === 0,
      }));

      const user = createSlice(({ get, set }) => ({
        name: () => get().name,
        setName: (name: string) => {
          set({ name });
          listeners.forEach((l) => l());
        },
      }));

      const items = createSlice(({ get, set }) => ({
        all: () => get().items,
        add: (item: string) => {
          set({ items: [...get().items, item] });
          listeners.forEach((l) => l());
        },
      }));

      return {
        counter,
        user,
        items,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    };

    describe('useSliceSelector', () => {
      it('should return selected values and re-render on changes', () => {
        const store = createTestStore();

        const { result } = renderHook(() =>
          useSliceSelector(store, (s) => ({
            count: s.counter.value(),
            isEven: s.counter.isEven(),
          }))
        );

        expect(result.current).toEqual({ count: 0, isEven: true });

        act(() => {
          store.counter.increment();
        });

        expect(result.current).toEqual({ count: 1, isEven: false });
      });

      it('should not re-render for unrelated changes', () => {
        const store = createTestStore();
        let renderCount = 0;

        const { result } = renderHook(() => {
          renderCount++;
          return useSliceSelector(store, (s) => s.counter.value());
        });

        expect(renderCount).toBe(1);
        expect(result.current).toBe(0);

        // Change unrelated state
        act(() => {
          store.user.setName('alice');
        });

        // Should not re-render
        expect(renderCount).toBe(1);
        expect(result.current).toBe(0);

        // Change selected state
        act(() => {
          store.counter.increment();
        });

        expect(renderCount).toBe(2);
        expect(result.current).toBe(1);
      });
    });

    describe('useSliceValues', () => {
      it('should use shallow equality by default', () => {
        const store = createTestStore();
        let renderCount = 0;

        const { result } = renderHook(() => {
          renderCount++;
          return useSliceValues(store, (s) => ({
            count: s.counter.value(),
            name: s.user.name(),
          }));
        });

        // Initial render count (React Testing Library may cause extra renders)
        const initialRenderCount = renderCount;
        expect(result.current).toEqual({ count: 0, name: 'test' });

        // Multiple updates that result in same values
        act(() => {
          store.counter.increment();
          store.counter.increment();
          store.user.setName('test'); // Same name
          store.counter.increment();
          store.counter.increment();
          // Back to count: 4, name: 'test'
        });

        // Should have re-rendered for count changes
        expect(renderCount).toBeGreaterThan(initialRenderCount);
        expect(result.current).toEqual({ count: 4, name: 'test' });
      });
    });

    describe('useLattice', () => {
      it('should provide both values and slices', () => {
        const store = createTestStore();

        const { result } = renderHook(() =>
          useLattice(store, (s) => ({
            count: s.counter.value(),
          }))
        );

        expect(result.current.values).toEqual({ count: 0 });
        expect(result.current.slices).toBe(store);

        // Can use slices to trigger actions
        act(() => {
          result.current.slices.counter.increment();
        });

        expect(result.current.values).toEqual({ count: 1 });
      });
    });
  });
}
