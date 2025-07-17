import React, { useMemo, useEffect } from 'react';
import { createLattice } from '@lattice/lattice';
import { LatticeContext, StoreContext } from './context';
import type { LatticeProviderProps, StoreProviderProps } from './types';

/**
 * Provides a Lattice context to all child components.
 * This creates an isolated scope for signals, computed values, and effects.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <LatticeProvider>
 *       <YourApp />
 *     </LatticeProvider>
 *   );
 * }
 * ```
 */
export function LatticeProvider({ children, context }: LatticeProviderProps) {
  // Create a Lattice context if one wasn't provided
  const lattice = useMemo(() => context ?? createLattice(), [context]);

  // Dispose the context when the provider unmounts (only if we created it)
  useEffect(() => {
    if (!context) return () => lattice.dispose();

    // No cleanup needed if using provided context
    return undefined;
  }, [lattice, context]);

  return (
    <LatticeContext.Provider value={lattice}>
      {children}
    </LatticeContext.Provider>
  );
}

/**
 * Provides a Store instance to all child components.
 * This allows child components to access the store via useStoreContext.
 *
 * @example
 * ```tsx
 * const todoStore = createStore({ todos: [], filter: 'all' });
 *
 * function App() {
 *   return (
 *     <StoreProvider store={todoStore}>
 *       <TodoList />
 *       <TodoFilters />
 *     </StoreProvider>
 *   );
 * }
 * ```
 */
export function StoreProvider<T extends Record<string, unknown>>({
  store,
  children,
}: StoreProviderProps<T>) {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
