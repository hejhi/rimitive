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

// WeakMap cache for selector results across all components
// This enables sharing computed values between components using the same selector
const selectorCache = new WeakMap<StoreApi<any>, Map<Function, { value: any; state: any }>>();

// Global subscription deduplication
const subscriptionMap = new WeakMap<StoreApi<any>, {
  listeners: Set<() => void>;
  unsubscribe?: () => void;
}>();

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
// For React 16/17 users, consider wrapping multiple setState calls in 
// ReactDOM.unstable_batchedUpdates() for better performance

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

  // Cleanup caches on unmount
  useEffect(() => {
    return () => {
      // Clean up selector cache for this store
      const cache = selectorCache.get(store.api);
      if (cache) {
        cache.clear();
        selectorCache.delete(store.api);
      }
      
      // Clean up subscription manager
      const subManager = subscriptionMap.get(store.api);
      if (subManager) {
        subManager.listeners.clear();
        if (subManager.unsubscribe) {
          subManager.unsubscribe();
        }
        subscriptionMap.delete(store.api);
      }
    };
  }, [store.api]);

  // Return merged object with stable API
  // Performance: Object.assign is faster than spread for this use case
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
  // Get or create cache for this store
  let storeCache = selectorCache.get(store);
  if (!storeCache) {
    storeCache = new Map();
    selectorCache.set(store, storeCache);
  }

  // Use ref for mutable selector state to avoid recreating functions
  const selectorRef = useRef<{
    selector: (state: Store) => Selected;
    equalityFn: (a: Selected, b: Selected) => boolean;
    value: Selected;
    cacheEntry?: { value: any; state: any };
  }>();

  if (!selectorRef.current) {
    // Check cache first
    const cachedEntry = storeCache.get(selector);
    const currentState = store.getState();
    
    let initialValue: Selected;
    if (cachedEntry && cachedEntry.state === currentState) {
      // Use cached value if state hasn't changed
      initialValue = cachedEntry.value;
    } else {
      // Compute new value and cache it
      initialValue = selector(currentState);
      storeCache.set(selector, { value: initialValue, state: currentState });
    }

    selectorRef.current = {
      selector,
      equalityFn,
      value: initialValue,
      cacheEntry: storeCache.get(selector),
    };
  }

  // Update refs without causing re-subscriptions
  selectorRef.current.selector = selector;
  selectorRef.current.equalityFn = equalityFn;

  // Stable getSnapshot function with caching
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const cache = selectorCache.get(store);
    const cachedEntry = cache?.get(selector);
    
    // Check if we can reuse cached value
    if (cachedEntry && cachedEntry.state === state) {
      selectorRef.current!.value = cachedEntry.value;
      return cachedEntry.value;
    }
    
    // Compute new value
    const newValue = selectorRef.current!.selector(state);
    
    // Update cache
    if (cache) {
      cache.set(selector, { value: newValue, state });
    }
    
    // Memoize selector result
    if (!selectorRef.current!.equalityFn(selectorRef.current!.value, newValue)) {
      selectorRef.current!.value = newValue;
    }
    
    return selectorRef.current!.value;
  }, [store, selector]);

  // Stable subscribe function with equality checks
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Check for existing subscription manager
      let subManager = subscriptionMap.get(store);
      
      if (!subManager) {
        // Create new subscription manager
        subManager = {
          listeners: new Set(),
          unsubscribe: undefined,
        };
        subscriptionMap.set(store, subManager);
      }
      
      // Add our listener
      const wrappedListener = () => {
        const state = store.getState();
        const cache = selectorCache.get(store);
        const cachedEntry = cache?.get(selector);
        
        // Skip if value is already cached for this state
        if (cachedEntry && cachedEntry.state === state) {
          if (!selectorRef.current!.equalityFn(selectorRef.current!.value, cachedEntry.value)) {
            selectorRef.current!.value = cachedEntry.value;
            onStoreChange();
          }
          return;
        }
        
        const newValue = selectorRef.current!.selector(state);
        
        // Update cache
        if (cache) {
          cache.set(selector, { value: newValue, state });
        }
        
        if (!selectorRef.current!.equalityFn(selectorRef.current!.value, newValue)) {
          selectorRef.current!.value = newValue;
          onStoreChange();
        }
      };
      
      subManager.listeners.add(wrappedListener);
      
      // Create shared subscription if needed
      if (!subManager.unsubscribe) {
        subManager.unsubscribe = store.subscribe(() => {
          // Notify all deduplicated listeners
          const listeners = Array.from(subManager!.listeners);
          for (const listener of listeners) {
            listener();
          }
        });
      }
      
      // Return cleanup function
      return () => {
        subManager!.listeners.delete(wrappedListener);
        
        // Clean up shared subscription if no more listeners
        if (subManager!.listeners.size === 0 && subManager!.unsubscribe) {
          subManager!.unsubscribe();
          subManager!.unsubscribe = undefined;
          subscriptionMap.delete(store);
        }
      };
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
 * 
 * Performance optimizations:
 * - Early exit on reference equality
 * - Fast path for different types
 * - Optimized key iteration
 * - Avoid repeated property access
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  // Fast path: same reference
  if (Object.is(a, b)) return true;

  // Fast path: different types or null/undefined
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
  
  // Cache key arrays to avoid multiple calls
  const keysA = Object.keys(aObj);
  
  // Fast path: different number of keys
  if (keysA.length !== Object.keys(bObj).length) return false;

  // Optimized property comparison
  // Using for-of is slightly faster than indexed loop in modern JS engines
  for (const key of keysA) {
    // Single lookup and comparison
    if (!(key in bObj) || !Object.is(aObj[key], bObj[key])) {
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
