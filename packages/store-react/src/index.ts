/**
 * @fileoverview Pure React state management library
 * 
 * A lightweight, component-scoped state management solution for React.
 * Zero dependencies, full TypeScript support, and automatic cleanup.
 */

import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react';

// ============================================================================
// Core Types
// ============================================================================

export type SetState<T> = (updates: Partial<T>) => void;
export type GetState<T> = () => T;
export type Subscribe = (listener: () => void) => () => void;

export type StoreCreator<T> = (
  set: SetState<T>,
  get: GetState<T>
) => T;

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
 * @returns The store with state and actions
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
export function useStore<T>(
  createStore: StoreCreator<T>
): T & StoreApi<T> {
  // Use ref to store mutable values
  const storeRef = useRef<{
    currentStore: T;
    listeners: Set<() => void>;
    api: StoreApi<T>;
    storeWithApi: T & StoreApi<T>;
  }>();

  // State to trigger re-renders
  const [, forceUpdate] = useState({});

  // Initialize store once
  if (!storeRef.current) {
    const listeners = new Set<() => void>();
    let currentStore: T;
    let storeWithApi: T & StoreApi<T>;

    const get: GetState<T> = () => currentStore;
    
    const set: SetState<T> = (updates) => {
      const nextStore = { ...currentStore, ...updates };
      
      // Check if anything actually changed
      const hasChanges = Object.keys(updates).some(
        key => !Object.is(currentStore[key as keyof T], nextStore[key as keyof T])
      );

      if (hasChanges) {
        currentStore = nextStore;
        storeRef.current!.currentStore = currentStore;
        
        // Update the combined object
        storeWithApi = { ...currentStore, ...api };
        storeRef.current!.storeWithApi = storeWithApi;
        
        // Notify all listeners
        listeners.forEach(listener => {
          try {
            listener();
          } catch (error) {
            console.error('Error in store listener:', error);
          }
        });
        
        // Trigger re-render of this component
        forceUpdate({});
      }
    };

    // Create the store
    currentStore = createStore(set, get);

    const api: StoreApi<T> = {
      getState: get,
      setState: set,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      destroy: () => {
        listeners.clear();
      }
    };

    // Create combined object
    storeWithApi = { ...currentStore, ...api };

    storeRef.current = {
      currentStore,
      listeners,
      api,
      storeWithApi
    };
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      storeRef.current?.api.destroy();
    };
  }, []);

  // Return the combined store and API
  return storeRef.current.storeWithApi;
}

// ============================================================================
// Selector Hook
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
  const [, forceUpdate] = useState({});
  const selectorRef = useRef(selector);
  const selectedRef = useRef<Selected>();
  const equalityFnRef = useRef(equalityFn);

  // Update refs
  selectorRef.current = selector;
  equalityFnRef.current = equalityFn;

  // Get current value
  const currentValue = selectorRef.current(store.getState());
  
  // Initialize selected value
  if (selectedRef.current === undefined) {
    selectedRef.current = currentValue;
  }

  useEffect(() => {
    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      const nextSelected = selectorRef.current(store.getState());
      
      if (selectedRef.current !== undefined && !equalityFnRef.current(selectedRef.current, nextSelected)) {
        selectedRef.current = nextSelected;
        forceUpdate({});
      }
    });

    // Check for missed update between render and effect
    const currentSelected = selectorRef.current(store.getState());
    if (selectedRef.current !== undefined && !equalityFnRef.current(selectedRef.current, currentSelected)) {
      selectedRef.current = currentSelected;
      forceUpdate({});
    }

    return unsubscribe;
  }, [store]);

  return currentValue;
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
    }
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
    useStore: Context.useStore
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Shallow equality function for object comparison.
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

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
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