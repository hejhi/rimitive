import { useEffect, useRef } from 'react';
import { compose } from '@lattice/lattice';
import type { Module, ComposedContext } from '@lattice/lattice';

/**
 * Create a Lattice context with modules that is scoped to the component lifecycle.
 * The context will be automatically disposed when the component unmounts.
 *
 * @param modules - The Lattice modules to include in the context
 * @returns A context with implementations from all provided modules
 *
 * @example
 * ```tsx
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 *
 * function App() {
 *   // Create a context with specific modules
 *   const context = useLatticeContext(SignalModule, ComputedModule, EffectModule);
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
export function useLatticeContext<M extends Module[]>(
  ...modules: M
): ComposedContext<M> {
  // Create context only once, using ref to ensure stability
  const contextRef = useRef<ComposedContext<M> | null>(null);

  if (!contextRef.current) contextRef.current = compose(...modules)();

  const context = contextRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => context.dispose();
  }, [context]);

  return context;
}
