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

    const getState: GetState<T> = () => state;

    const setState: SetState<T> = (updates) => {
      const partial = typeof updates === 'function' ? updates(state) : updates;
      
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
        state = { ...state, ...partial };
        storeRef.current!.state = state;
        
        // Notify all listeners
        listeners.forEach(listener => {
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
    };

    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
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

  // Return merged object with stable reference
  // We cache this to avoid creating new objects on every render
  const resultRef = useRef<T & StoreApi<T>>();
  if (!resultRef.current) {
    resultRef.current = { ...currentState, ...store.api };
  } else {
    // Update the cached result with new state values
    Object.assign(resultRef.current, currentState);
  }
  
  return resultRef.current;
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
  // Get the current selected value
  const getSnapshot = useCallback(() => {
    return selector(store.getState());
  }, [store, selector]);

  // Subscribe with selector
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let currentValue = selector(store.getState());
      
      return store.subscribe(() => {
        const nextValue = selector(store.getState());
        if (!equalityFn(currentValue, nextValue)) {
          currentValue = nextValue;
          onStoreChange();
        }
      });
    },
    [store, selector, equalityFn]
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