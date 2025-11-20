import { useEffect, useRef } from 'react';
import { createContext } from '@lattice/lattice';
import type { LatticeExtension, ExtensionsToContext } from '@lattice/lattice';

/**
 * Create a Lattice context with custom extensions that is scoped to the component lifecycle.
 * The context will be automatically disposed when the component unmounts.
 *
 * @param extensions - The Lattice extensions to include in the context
 * @returns A context with methods from all provided extensions
 *
 * @example
 * ```tsx
 * import { signalExtension, computedExtension } from '@lattice/signals';
 *
 * function App() {
 *   // Create a context with specific extensions
 *   const context = useLatticeContext(signalExtension, computedExtension);
 *
 *   const count = useRef(context.signal(0));
 *   const doubled = useRef(context.computed(() => count.current.value * 2));
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // For convenience with signals, you can use coreExtensions
 * import { coreExtensions } from '@lattice/signals';
 *
 * function TodoApp() {
 *   const context = useLatticeContext(...coreExtensions);
 *
 *   const todos = useRef(context.signal([]));
 *   const filter = useRef(context.signal('all'));
 *
 *   return (
 *     <AppContext.Provider value={{ todos: todos.current, filter: filter.current }}>
 *       <TodoList />
 *     </AppContext.Provider>
 *   );
 * }
 * ```
 */
export function useLatticeContext<
  E extends readonly LatticeExtension<string, unknown>[],
>(...extensions: E): ExtensionsToContext<E> {
  // Create context only once, using ref to ensure stability
  const contextRef = useRef<ExtensionsToContext<E> | null>(null);

  if (!contextRef.current) contextRef.current = createContext(...extensions);

  const context = contextRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => context.dispose();
  }, [context]);

  return context;
}
