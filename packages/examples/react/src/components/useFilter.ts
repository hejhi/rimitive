/**
 * Filter Component - React Version
 *
 * Returns actual signal/computed functions for use with useSubscribe
 */

import type { SignalFunction } from '@lattice/signals/signal';
import type { UseTodo } from './useTodoList';

export type FilterType = 'all' | 'active' | 'completed';

export interface UseFilter {
  currentFilter: SignalFunction<FilterType>;
  setFilter(filter: FilterType): void;
  filterTodos(todos: UseTodo[]): UseTodo[];
}

export function useFilter(api: {
  signal: <T>(value: T) => SignalFunction<T>;
}): UseFilter {
  const currentFilter = api.signal<FilterType>('all');

  return {
    // Signal - for useSubscribe
    currentFilter,

    // Actions
    setFilter(filter: FilterType) {
      currentFilter(filter);
    },

    // Utility - filter any todo list
    filterTodos(todos: UseTodo[]): UseTodo[] {
      const filter = currentFilter();
      if (filter === 'active') return todos.filter((t) => !t.completed);
      if (filter === 'completed') return todos.filter((t) => t.completed);
      return todos;
    },
  };
}
