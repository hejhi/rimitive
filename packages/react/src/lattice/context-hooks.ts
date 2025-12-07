import { useEffect, useRef } from 'react';
import { compose } from '@lattice/lattice';
import type { ServiceDefinition, LatticeContext } from '@lattice/lattice';

/**
 * Create a Lattice context with custom extensions that is scoped to the component lifecycle.
 * The context will be automatically disposed when the component unmounts.
 *
 * @param extensions - The Lattice extensions to include in the context
 * @returns A context with methods from all provided extensions
 *
 * @example
 * ```tsx
 * import { Signal, Computed, deps } from '@lattice/signals/extend';
 *
 * function App() {
 *   // Create a context with specific extensions
 *   const helpers = deps();
 *   const context = useLatticeContext(
 *     Signal().create(helpers),
 *     Computed().create(helpers)
 *   );
 *
 *   const count = useRef(context.signal(0));
 *   const doubled = useRef(context.computed(() => count.current() * 2));
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // For most use cases, prefer createSignals() instead of useLatticeContext
 * import { createSignals } from '@lattice/signals';
 *
 * function TodoApp() {
 *   const svcRef = useRef(createSignals()());
 *   const { signal } = svcRef.current;
 *
 *   const todos = useRef(signal([]));
 *   const filter = useRef(signal('all'));
 *
 *   // Dispose on unmount
 *   useEffect(() => () => svcRef.current.dispose(), []);
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
  E extends readonly ServiceDefinition<string, unknown>[],
>(...extensions: E): LatticeContext<E> {
  // Create context only once, using ref to ensure stability
  const contextRef = useRef<LatticeContext<E> | null>(null);

  if (!contextRef.current) contextRef.current = compose(...extensions)();

  const context = contextRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => context.dispose();
  }, [context]);

  return context;
}
