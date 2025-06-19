/**
 * @fileoverview Pure React state management library
 *
 * A lightweight, component-scoped state management solution for React.
 * Zero dependencies, full TypeScript support, and automatic cleanup.
 */

import React, {
  useEffect,
  useRef,
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from 'react';

// ============================================================================
// Core Types
// ============================================================================

export type SetState<T> = (
  updates: Partial<T> | ((state: T) => Partial<T>)
) => void;
export type GetState<T> = () => T;
export type Subscribe = (listener: () => void) => () => void;

export type StoreCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

export interface StoreApi<T> {
  getState: () => T;
  setState: SetState<T>;
  subscribe: Subscribe;
  destroy: () => void;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Creates a component-scoped store with React hooks.
 *
 * @param createStore - Function that creates the store with actions
 * @returns The store with state and actions combined
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const store = useStore((set, get) => ({
 *     count: 0,
 *     increment: () => set({ count: get().count + 1 }),
 *     decrement: () => set({ count: get().count - 1 })
 *   }));
 *
 *   return (
 *     <div>
 *       <span>{store.count}</span>
 *       <button onClick={store.increment}>+</button>
 *       <button onClick={store.decrement}>-</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStore<T>(createStore: StoreCreator<T>): T & StoreApi<T> {
  // Create store instance once
  const storeRef = useRef<{
    state: T;
    listeners: Set<() => void>;
    api: StoreApi<T>;
  }>();

  if (!storeRef.current) {
    const listeners = new Set<() => void>();
    let state: T;

    // Create stable API functions that will persist across renders
    const api: StoreApi<T> = {
      getState: () => storeRef.current!.state,
      setState: (updates) => {
        const state = storeRef.current!.state;
        const partial =
          typeof updates === 'function' ? updates(state) : updates;

        // Optimized shallow merge with change detection
        let hasChanges = false;

        // Check for changes first
        for (const key in partial) {
          if (!Object.is(state[key], partial[key])) {
            hasChanges = true;
            break;
          }
        }

        if (hasChanges) {
          // Create new state object
          const newState = { ...state, ...partial };
          storeRef.current!.state = newState;

          // Notify all listeners
          listeners.forEach((listener) => {
            try {
              listener();
            } catch (error) {
              // In production, errors are silent to avoid breaking other listeners
              if (process.env.NODE_ENV !== 'production') {
                console.error('Error in store listener:', error);
              }
            }
          });
        }
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      destroy: () => {
        listeners.clear();
      },
    };

    // Create the store
    state = createStore(api.setState, api.getState);

    storeRef.current = {
      state,
      listeners,
      api,
    };
  }

  const store = storeRef.current;

  // Use useSyncExternalStore for optimal React 18+ integration
  const currentState = useSyncExternalStore(
    store.api.subscribe,
    () => store.state,
    () => store.state // Server snapshot
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      store.api.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Create stable merged result - only recreate when state actually changes
  const resultRef = useRef<T & StoreApi<T>>();
  const prevStateRef = useRef<T>();

  if (!resultRef.current || prevStateRef.current !== currentState) {
    resultRef.current = { ...currentState, ...store.api };
    prevStateRef.current = currentState;
  }

  return resultRef.current;
}

// ============================================================================
// Selector Hook with Performance Optimizations
// ============================================================================

/**
 * Subscribe to specific parts of the store with a selector.
 * 
 * This hook implements a double equality check pattern:
 * 1. In subscribeWithSelector: Filters updates at subscription level (performance)
 * 2. In getSnapshot: Ensures stable references for React's multiple calls (correctness)
 * 
 * Both checks are necessary because React's useSyncExternalStore may call
 * getSnapshot independently of subscriptions during concurrent features,
 * StrictMode, hydration, and other edge cases.
 *
 * @param store - Store instance from useStore
 * @param selector - Function to select specific values
 * @param equalityFn - Optional equality function (default: Object.is)
 * @returns Selected value
 *
 * @example
 * ```tsx
 * function CountDisplay() {
 *   const store = useStore(createStore);
 *   const count = useStoreSelector(store, s => s.count);
 *   const isEven = useStoreSelector(store, s => s.count % 2 === 0);
 *
 *   return <div>Count: {count} (even: {isEven})</div>;
 * }
 * ```
 */
export function useStoreSelector<Store, Selected>(
  store: Store & StoreApi<Store>,
  selector: (state: Store) => Selected,
  equalityFn: (a: Selected, b: Selected) => boolean = Object.is
): Selected {
  // Extract stable API methods - these don't change
  const getState = store.getState;
  const subscribe = store.subscribe;

  // IMPORTANT: We use refs to ensure the latest selector and equality function
  // are always used without causing hook dependency changes. This prevents
  // unnecessary re-subscriptions when the selector or equalityFn references change.
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const equalityFnRef = useRef(equalityFn);
  equalityFnRef.current = equalityFn;

  // Cache for the selected value to ensure stable references.
  // This is crucial for React's useSyncExternalStore which requires
  // getSnapshot to return the same reference when data hasn't changed.
  const selectedValueRef = useRef<Selected>();
  const hasInitialized = useRef(false);

  // Create a stable getSnapshot function that returns cached values.
  // React's useSyncExternalStore may call this multiple times:
  // - During initial render (before subscription)
  // - Multiple times in StrictMode for detecting side effects
  // - During concurrent features (Suspense, time slicing)
  // - During hydration for server/client reconciliation
  // - When React checks if re-rendering is needed
  const getSnapshot = useCallback(() => {
    const currentState = getState();
    const nextValue = selectorRef.current(currentState);
    
    // Initialize on first call
    if (!hasInitialized.current) {
      selectedValueRef.current = nextValue;
      hasInitialized.current = true;
      return nextValue;
    }
    
    // CRITICAL: This equality check ensures stable references between React's
    // multiple getSnapshot calls. Without it, returning new objects would
    // cause infinite re-renders. This is defensive programming to handle
    // React's edge cases, not a performance optimization.
    if (!equalityFnRef.current(selectedValueRef.current as Selected, nextValue)) {
      selectedValueRef.current = nextValue;
    }
    
    return selectedValueRef.current as Selected;
  }, [getState]);

  // Create stable subscribe function with selector-specific filtering.
  // This implements the "selector pattern" where we only notify React
  // of changes when the selected value actually changes.
  const subscribeWithSelector = useCallback(
    (onStoreChange: () => void) => {
      return subscribe(() => {
        const currentState = getState();
        const nextValue = selectorRef.current(currentState);
        
        // PERFORMANCE: This equality check filters out unnecessary re-renders
        // at the subscription level. It prevents React from even considering
        // a re-render when the selected value hasn't changed.
        // This is different from the getSnapshot check which handles React's
        // internal multiple calls.
        if (!equalityFnRef.current(selectedValueRef.current as Selected, nextValue)) {
          onStoreChange();
        }
      });
    },
    [subscribe, getState]
  );

  return useSyncExternalStore(subscribeWithSelector, getSnapshot, getSnapshot);
}

// ============================================================================
// Context Support
// ============================================================================

/**
 * Creates a typed context for a store.
 *
 * @example
 * ```tsx
 * const TodoStoreContext = createStoreContext<TodoStore>();
 *
 * function Component() {
 *   const store = useStore(createTodoStore);
 *   return (
 *     <TodoStoreContext.Provider value={store}>
 *       <TodoList />
 *     </TodoStoreContext.Provider>
 *   );
 * }
 *
 * function TodoList() {
 *   const store = useStoreContext(TodoStoreContext);
 *   // Use store...
 * }
 * ```
 */
export function createStoreContext<Store>() {
  const Context = createContext<(Store & StoreApi<Store>) | null>(null);

  return {
    Provider: Context.Provider,
    Consumer: Context.Consumer,
    /**
     * Hook to access store from context
     */
    useStore: () => {
      const store = useContext(Context);
      if (!store) {
        throw new Error('useStore must be used within a Provider');
      }
      return store;
    },
  };
}

/**
 * Generic provider component for any store.
 *
 * @example
 * ```tsx
 * function Component() {
 *   const store = useStore(createComponentStore);
 *   return (
 *     <StoreProvider store={store}>
 *       <ComponentContent />
 *     </StoreProvider>
 *   );
 * }
 * ```
 */
export interface StoreProviderProps<Store> {
  store: Store & StoreApi<Store>;
  children: ReactNode;
}

export function createStoreProvider<Store>() {
  const Context = createStoreContext<Store>();

  function StoreProvider({ store, children }: StoreProviderProps<Store>) {
    return React.createElement(Context.Provider, { value: store }, children);
  }

  return {
    StoreProvider,
    useStore: Context.useStore,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Optimized shallow equality function for object comparison.
 * Useful with useStoreSelector for object selections.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

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

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]!;
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as any)[key], (b as any)[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Hook for subscribing to store changes without selecting values.
 * Useful for side effects.
 *
 * @example
 * ```tsx
 * function Logger() {
 *   const store = useStore(createStore);
 *
 *   useStoreSubscribe(store, (state) => {
 *     console.log('State changed:', state);
 *   });
 *
 *   return null;
 * }
 * ```
 */
export function useStoreSubscribe<Store>(
  store: Store & StoreApi<Store>,
  callback: (state: Store) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Call immediately with current state
    callbackRef.current(store.getState());

    // Subscribe to changes
    return store.subscribe(() => {
      callbackRef.current(store.getState());
    });
  }, [store]);
}

// ============================================================================
// Type utilities
// ============================================================================

export type Store<S> = S & StoreApi<S>;
