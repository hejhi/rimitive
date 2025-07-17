import { useContext, useEffect, useRef, useMemo } from 'react';
import type {
  Store,
  LatticeContext as BaseLatticeContext,
} from '@lattice/lattice';
import { useSubscribe } from '../signals/hooks';
import { LatticeContext, StoreContext } from './context';
import type { StoreFactory, StoreSelector } from './types';

/**
 * Get the current Lattice context from the nearest LatticeProvider.
 * If no provider is found, a default global context is returned.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const lattice = useLattice();
 *   const computed = lattice.computed(() => ...);
 * }
 * ```
 */
export function useLattice(): BaseLatticeContext {
  const context = useContext(LatticeContext);
  if (!context) {
    throw new Error(
      'useLattice must be used within a LatticeProvider. ' +
        'Wrap your app with <LatticeProvider> to provide a Lattice context.'
    );
  }
  return context;
}

/**
 * Create a store that is scoped to the component lifecycle.
 * The store will be automatically disposed when the component unmounts.
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const store = useStore(() => createStore({
 *     todos: [],
 *     filter: 'all'
 *   }));
 *
 *   return <TodoListView store={store} />;
 * }
 * ```
 */
export function useStore<T extends Record<string, unknown>>(
  factory: StoreFactory<T>
): Store<T> {
  const storeRef = useRef<Store<T> | null>(null);

  // Create store only once, using ref to ensure stability
  if (!storeRef.current) {
    storeRef.current = factory();
  }

  const store = storeRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => store.dispose();
  }, [store]);

  return store;
}

/**
 * Get a store from the nearest StoreProvider.
 *
 * @example
 * ```tsx
 * function TodoItem() {
 *   const store = useStoreContext<TodoStore>();
 *   const todos = useSignal(store.state.todos);
 * }
 * ```
 */
export function useStoreContext<T extends Record<string, unknown>>(): Store<T> {
  const store = useContext(StoreContext);

  if (!store) {
    throw new Error(
      'useStoreContext must be used within a StoreProvider. ' +
        'Wrap your component tree with <StoreProvider store={store}>.'
    );
  }
  return store as Store<T>;
}

/**
 * Select and subscribe to a slice of store state.
 * When no selector is provided, returns the entire state.
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const todos = useSelect(store => store.todos);
 *   return <ul>{todos.map(todo => <li>{todo.text}</li>)}</ul>;
 * }
 * ```
 */
export function useSelect<T extends Record<string, unknown>, R = T>(
  selector?: StoreSelector<T, R>
): R {
  const store = useStoreContext<T>();
  const computed = useMemo(
    () => store.select(selector ?? ((state: T) => state as unknown as R)),
    [store, selector]
  );

  return useSubscribe(computed);
}

/**
 * Create a store selector hook for a specific store.
 * This is useful for creating typed selectors for your stores.
 *
 * @example
 * ```tsx
 * const useTodoStore = createStoreHook<TodoState>();
 *
 * function TodoCount() {
 *   const count = useTodoStore(state => state.todos.length);
 *   return <div>Total: {count}</div>;
 * }
 * ```
 */
export function createStoreHook<T extends Record<string, unknown>>() {
  return function useTypedStore<R = T>(selector?: StoreSelector<T, R>): R {
    return useSelect(selector);
  };
}
