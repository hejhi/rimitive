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

// Production mode detection for optimizations
const DEV = process.env.NODE_ENV !== 'production';

// Constants for better performance
const EMPTY_DEPS: readonly [] = [];

// ============================================================================
// Core Types
// ============================================================================

export type SetState<T> = (updates: Partial<T> | ((state: T) => Partial<T>)) => void;
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
// Performance optimizations
// ============================================================================

// React 18+ automatically batches updates, so we don't need manual batching
// This improves compatibility with testing libraries

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
    notifying: boolean;
    api: StoreApi<T>;
  }>();

  if (!storeRef.current) {
    const listeners = new Set<() => void>();
    let state: T;
    let notifying = false;
    const pendingUnsubscribes = new Set<() => void>();

    const notifyListeners = () => {
      if (notifying) return;
      notifying = true;
      
      // Snapshot listeners to handle unsubscribe during notification
      const currentListeners = Array.from(listeners);
      for (const listener of currentListeners) {
        if (!pendingUnsubscribes.has(listener)) {
          if (DEV) {
            try {
              listener();
            } catch (error) {
              console.error('Error in store listener:', error);
            }
          } else {
            listener();
          }
        }
      }
      
      notifying = false;
      
      // Process pending unsubscribes
      for (const listener of pendingUnsubscribes) {
        listeners.delete(listener);
      }
      pendingUnsubscribes.clear();
    };

    const getState: GetState<T> = () => state;

    const setState: SetState<T> = (updates) => {
      const partial = typeof updates === 'function' ? updates(state) : updates;
      
      // Optimized shallow merge with change detection
      let hasChanges = false;
      const nextState = { ...state };
      
      // Apply updates and detect changes in one pass
      for (const key in partial) {
        if (!Object.is(state[key], partial[key])) {
          hasChanges = true;
          nextState[key] = partial[key]!;
        }
      }

      if (hasChanges) {
        state = nextState;
        storeRef.current!.state = state;
        notifyListeners();
      }
    };

    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => {
        if (notifying) {
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    };

    const destroy = () => {
      listeners.clear();
    };

    // Create the store
    state = createStore(setState, getState);

    // Create stable API
    const api: StoreApi<T> = {
      getState,
      setState,
      subscribe,
      destroy,
    };

    storeRef.current = {
      state,
      listeners,
      notifying: false,
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
  }, EMPTY_DEPS); // eslint-disable-line react-hooks/exhaustive-deps

  // Return merged object with stable API
  return Object.assign({}, currentState, store.api) as T & StoreApi<T>;
}

// ============================================================================
// Selector Hook with Performance Optimizations
// ============================================================================

/**
 * Subscribe to specific parts of the store with a selector.
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
  // Use ref for mutable selector state to avoid recreating functions
  const selectorRef = useRef<{
    selector: (state: Store) => Selected;
    equalityFn: (a: Selected, b: Selected) => boolean;
    value: Selected;
  }>();

  if (!selectorRef.current) {
    selectorRef.current = {
      selector,
      equalityFn,
      value: selector(store.getState()),
    };
  }

  // Update refs without causing re-subscriptions
  selectorRef.current.selector = selector;
  selectorRef.current.equalityFn = equalityFn;

  // Stable getSnapshot function
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const newValue = selectorRef.current!.selector(state);
    
    // Memoize selector result
    if (!selectorRef.current!.equalityFn(selectorRef.current!.value, newValue)) {
      selectorRef.current!.value = newValue;
    }
    
    return selectorRef.current!.value;
  }, [store]);

  // Stable subscribe function with equality checks
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return store.subscribe(() => {
        const state = store.getState();
        const newValue = selectorRef.current!.selector(state);
        
        if (!selectorRef.current!.equalityFn(selectorRef.current!.value, newValue)) {
          selectorRef.current!.value = newValue;
          onStoreChange();
        }
      });
    },
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
 * function App() {
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
        if (DEV) {
          throw new Error('useStore must be used within a Provider');
        }
        // In production, return a dummy store to prevent crashes
        return {} as Store & StoreApi<Store>;
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
 * function App() {
 *   const store = useStore(createAppStore);
 *   return (
 *     <StoreProvider store={store}>
 *       <AppContent />
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

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  // Get keys and compare lengths first
  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  
  if (keysA.length !== keysB.length) return false;

  // Compare all properties (optimized loop)
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]!;
    if (!Object.prototype.hasOwnProperty.call(bObj, key) || !Object.is(aObj[key], bObj[key])) {
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
  // Use ref to avoid re-subscribing when callback changes
  const callbackRef = useRef(callback);

  // Update callback ref without re-subscribing
  useEffect(() => {
    callbackRef.current = callback;
  });

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
