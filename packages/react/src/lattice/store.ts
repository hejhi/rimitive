/**
 * Store compatibility layer for React integration
 * 
 * Provides a Store-like API using the new context-based architecture
 */

import { createLattice } from '@lattice/lattice';
import type { LatticeContext, SignalState } from '@lattice/lattice';

/**
 * Store interface for React integration
 */
export interface Store<T extends Record<string, unknown>> {
  /**
   * Reactive state object where each property is a signal
   */
  state: SignalState<T>;
  
  /**
   * Batch update multiple state values
   */
  set(updates: Partial<T>): void;
  
  /**
   * Dispose the store and clean up all resources
   */
  dispose(): void;
  
  /**
   * The underlying lattice context
   */
  _context: LatticeContext;
}

/**
 * Create a store with the given initial state
 * 
 * @example
 * ```tsx
 * const store = createStore({
 *   todos: [],
 *   filter: 'all'
 * });
 * 
 * // Access signals
 * store.state.todos.value = [...todos, newTodo];
 * ```
 */
export function createStore<T extends Record<string, unknown>>(
  initialState: T
): Store<T> {
  // Create a lattice context for this store
  const context = createLattice();
  
  // Create signals for each property
  const state = {} as SignalState<T>;
  
  for (const [key, value] of Object.entries(initialState)) {
    state[key as keyof T] = context.signal(value as T[keyof T]);
  }
  
  return {
    state,
    set(updates: Partial<T>) {
      // Batch update multiple signals
      context.batch(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (key in state) {
            state[key as keyof T].value = value as T[keyof T];
          }
        }
      });
    },
    dispose: () => context.dispose(),
    _context: context,
  };
}