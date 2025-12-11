import { useEffect, useRef } from 'react';
import { compose } from '@lattice/lattice';
import type { Module, Use, ComposedContext } from '@lattice/lattice';

/**
 * Create a Lattice context with modules that is scoped to the component lifecycle.
 * The context will be automatically disposed when the component unmounts.
 *
 * @param modules - The Lattice modules to include in the context
 * @returns A Use context with implementations from all provided modules
 *
 * @example
 * ```tsx
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 *
 * function App() {
 *   // Create a context with specific modules
 *   const use = useLatticeContext(SignalModule, ComputedModule, EffectModule);
 *
 *   const count = useRef(use.signal(0));
 *   const doubled = useRef(use.computed(() => count.current() * 2));
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
 *   const use = useRef(createSignals());
 *   const { signal } = use.current;
 *
 *   const todos = useRef(signal([]));
 *   const filter = useRef(signal('all'));
 *
 *   // Dispose on unmount
 *   useEffect(() => () => use.current.dispose(), []);
 *
 *   return (
 *     <AppContext.Provider value={{ todos: todos.current, filter: filter.current }}>
 *       <TodoList />
 *     </AppContext.Provider>
 *   );
 * }
 * ```
 */
export function useLatticeContext<M extends Module[]>(
  ...modules: M
): Use<ComposedContext<M>> {
  // Create context only once, using ref to ensure stability
  const contextRef = useRef<Use<ComposedContext<M>> | null>(null);

  if (!contextRef.current) contextRef.current = compose(...modules);

  const context = contextRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => context.dispose();
  }, [context]);

  return context;
}
