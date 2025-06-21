/**
 * @fileoverview React bindings for Lattice Store
 * 
 * This provides React-specific hooks and utilities that wrap the vanilla store
 * with React 18+ optimizations like useSyncExternalStore.
 */

import React, {
  useEffect,
  useRef,
  useMemo,
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from 'react';
import { createVanillaStore, type StoreApi } from './vanilla';

// ============================================================================
// Core Types
// ============================================================================

export type SetState<T> = (
  updates: Partial<T> | ((state: T) => Partial<T>)
) => void;
export type GetState<T> = () => T;
export type Subscribe = (listener: () => void) => () => void;

export type StoreCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

// Re-export StoreApi from vanilla
export type { StoreApi };

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Creates a component-scoped store with React hooks.
 * This wraps the vanilla store with React-specific optimizations.
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
 *       <h1>{store.count}</h1>
 *       <button onClick={store.increment}>+</button>
 *       <button onClick={store.decrement}>-</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStore<T extends Record<string, any>>(
  createStore: StoreCreator<T>
): T & StoreApi<T> {
  // Create store instance once using vanilla store
  const storeRef = useRef<StoreApi<T>>();
  const methodsRef = useRef<T>();

  if (!storeRef.current) {
    storeRef.current = createVanillaStore<T>((set, get) => {
      const setState: SetState<T> = (updates) => {
        const resolved = typeof updates === 'function' ? updates(get()) : updates;
        set(resolved);
      };
      return createStore(setState, get);
    });
  }

  const store = storeRef.current;

  // Create methods once and store them
  if (!methodsRef.current) {
    const setState: SetState<T> = (updates) => {
      const resolved = typeof updates === 'function' ? updates(store.getState()) : updates;
      store.setState(resolved);
    };
    methodsRef.current = createStore(setState, store.getState);
  }

  // Use useSyncExternalStore for optimal React 18+ integration
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState // Server snapshot
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (store.destroy) {
        store.destroy();
      }
    };
  }, [store]);

  // Merge state with store API and methods - now stable
  return useMemo(() => {
    return {
      ...methodsRef.current,
      ...store,
      ...state,
    };
  }, [state, store]);
}

// ============================================================================
// Selector Hook
// ============================================================================

/**
 * Subscribe to specific parts of the store with a selector.
 * Implements double equality check pattern for correctness and performance.
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
  // Keep selector and equality function in refs to avoid recreating subscriptions
  const selectorRef = useRef(selector);
  const equalityFnRef = useRef(equalityFn);
  const selectedRef = useRef<Selected>();

  // Update refs on each render
  selectorRef.current = selector;
  equalityFnRef.current = equalityFn;

  // Create stable getSnapshot
  const getSnapshot = useCallback(() => {
    const selected = selectorRef.current(store.getState());
    
    // Ensure stable references for React's multiple calls
    if (selectedRef.current === undefined || !equalityFnRef.current(selectedRef.current, selected)) {
      selectedRef.current = selected;
    }
    
    return selectedRef.current;
  }, [store]);

  // Create filtered subscription
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return store.subscribe(() => {
        const nextSelected = selectorRef.current(store.getState());
        if (!equalityFnRef.current(selectedRef.current!, nextSelected)) {
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