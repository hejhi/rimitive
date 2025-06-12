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

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { subscribeToSlices, shallowEqual, type SubscribableStore } from '@lattice/core';

// Performance monitoring for development warnings
let storeCreationTimestamps: number[] = [];
const PERF_WARNING_THRESHOLD = 20; // Warn if more than 20 stores
const PERF_WARNING_WINDOW = 100; // Within 100ms

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
  equalityFn?: (a: Selected, b: Selected) => boolean
): Selected {
  // Track store creation in development for performance warnings
  if (process.env.NODE_ENV !== 'production') {
    const now = Date.now();
    storeCreationTimestamps.push(now);
    
    // Clean up old timestamps outside the warning window
    storeCreationTimestamps = storeCreationTimestamps.filter(
      timestamp => now - timestamp <= PERF_WARNING_WINDOW
    );
    
    // Warn if too many stores are being created rapidly
    if (storeCreationTimestamps.length > PERF_WARNING_THRESHOLD) {
      console.warn(
        `[Lattice Performance Warning] ${storeCreationTimestamps.length} stores created in ${PERF_WARNING_WINDOW}ms. ` +
        'Consider using shared stores instead of creating many component-scoped stores. ' +
        'See: https://lattice.dev/docs/performance#shared-stores'
      );
    }
  }
  
  // Store the selector and equality function in refs
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  
  const equalityFnRef = useRef(equalityFn);
  equalityFnRef.current = equalityFn;
  
  // Store the current selected value to ensure stable snapshots
  const selectedValueRef = useRef<Selected>();
  
  // Initialize the selected value if not set
  if (selectedValueRef.current === undefined) {
    selectedValueRef.current = selector(store);
  }
  
  // Create stable callbacks for useSyncExternalStore
  const subscribe = useCallback((onStoreChange: () => void) => {
    return subscribeToSlices(
      store,
      (slices) => {
        const nextValue = selectorRef.current(slices);
        const currentValue = selectedValueRef.current!;
        const isEqual = equalityFnRef.current 
          ? equalityFnRef.current(currentValue, nextValue)
          : Object.is(currentValue, nextValue);
          
        if (!isEqual) {
          selectedValueRef.current = nextValue;
          onStoreChange();
        }
        return nextValue;
      },
      () => {}, // Empty callback since we handle the change detection above
      { fireImmediately: false }
    );
  }, [store]);
  
  const getSnapshot = useCallback(() => selectedValueRef.current!, []);
  const getServerSnapshot = useCallback(() => selectorRef.current(store), [store]);
  
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
  selector: (slices: App) => Selected
): Selected {
  return useSliceSelector(store, selector, shallowEqual);
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
  equalityFn?: (a: Selected, b: Selected) => boolean
): {
  values: Selected;
  slices: App;
} {
  const values = useSliceSelector(store, selector, equalityFn);
  
  // Stable reference optimization - only create new object when values change
  const resultRef = useRef<{ values: Selected; slices: App }>();
  const prevValuesRef = useRef<Selected>();
  
  if (!resultRef.current || prevValuesRef.current !== values) {
    resultRef.current = { values, slices: store };
    prevValuesRef.current = values;
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
        items: [] as string[]
      });
      
      const listeners = new Set<() => void>();
      
      const counter = createSlice(({ get, set }) => ({
        value: () => get().count,
        increment: () => {
          set({ count: get().count + 1 });
          listeners.forEach(l => l());
        },
        isEven: () => get().count % 2 === 0
      }));
      
      const user = createSlice(({ get, set }) => ({
        name: () => get().name,
        setName: (name: string) => {
          set({ name });
          listeners.forEach(l => l());
        }
      }));
      
      const items = createSlice(({ get, set }) => ({
        all: () => get().items,
        add: (item: string) => {
          set({ items: [...get().items, item] });
          listeners.forEach(l => l());
        }
      }));
      
      return {
        counter,
        user,
        items,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      };
    };
    
    describe('useSliceSelector', () => {
      it('should return selected values and re-render on changes', () => {
        const store = createTestStore();
        
        const { result } = renderHook(() => 
          useSliceSelector(store, (s) => ({
            count: s.counter.value(),
            isEven: s.counter.isEven()
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
            name: s.user.name()
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
            count: s.counter.value()
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