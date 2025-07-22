import { useEffect, useRef } from 'react';
import { createLattice } from '@lattice/signals-store';
import type { LatticeContext } from '@lattice/signals-store';

/**
 * Create a Lattice context that is scoped to the component lifecycle.
 * The context will be automatically disposed when the component unmounts.
 *
 * @example
 * ```tsx
 * function TodoApp() {
 *   const context = useLatticeContext();
 *   
 *   // Create signals directly
 *   const todos = useRef(context.signal([]));
 *   const filter = useRef(context.signal('all'));
 *
 *   // Use standard React Context to share
 *   return (
 *     <AppContext.Provider value={{ todos: todos.current, filter: filter.current }}>
 *       <TodoList />
 *     </AppContext.Provider>
 *   );
 * }
 * 
 * // In child components
 * function TodoList() {
 *   const { todos } = useContext(AppContext);
 *   const todoList = useSubscribe(todos);
 *   // ...
 * }
 * ```
 */
export function useLatticeContext(): LatticeContext {
  // Create context only once, using ref to ensure stability
  const contextRef = useRef<LatticeContext | null>(null);
  
  if (!contextRef.current) {
    contextRef.current = createLattice();
  }
  
  const context = contextRef.current;

  // Dispose on unmount
  useEffect(() => {
    return () => context.dispose();
  }, [context]);

  return context;
}