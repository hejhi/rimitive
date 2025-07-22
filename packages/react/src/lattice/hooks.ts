import { useEffect, useRef } from 'react';
import type { Store } from './store';
import type { StoreFactory } from './types';

/**
 * Create a store that is scoped to the component lifecycle.
 * The store will be automatically disposed when the component unmounts.
 *
 * @example
 * ```tsx
 * function TodoApp() {
 *   const store = useStore(() => createStore({
 *     todos: [],
 *     filter: 'all'
 *   }));
 *
 *   // Use standard React Context to share the store
 *   return (
 *     <TodoContext.Provider value={store}>
 *       <TodoList />
 *     </TodoContext.Provider>
 *   );
 * }
 * 
 * // In child components
 * function TodoList() {
 *   const store = useContext(TodoContext);
 *   const todos = useSubscribe(store.state.todos);
 *   // ...
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
