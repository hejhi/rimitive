/**
 * Filter Component - React Version
 *
 * Returns actual signal/computed functions for use with useSubscribe
 */

import type { SignalFunction } from '@lattice/signals/signal';
import type { Todo } from './todo-list';

export type FilterType = 'all' | 'active' | 'completed';

export interface FilterAPI {
  currentFilter: SignalFunction<FilterType>;
  setFilter(filter: FilterType): void;
  filterTodos(todos: Todo[]): Todo[];
}

export function createFilter(api: {
  signal: <T>(value: T) => SignalFunction<T>;
}): FilterAPI {
  const currentFilter = api.signal<FilterType>('all');

  return {
    // Signal - for useSubscribe
    currentFilter,

    // Actions
    setFilter(filter: FilterType) {
      currentFilter(filter);
    },

    // Utility - filter any todo list
    filterTodos(todos: Todo[]): Todo[] {
      const filter = currentFilter();
      if (filter === 'active') return todos.filter((t) => !t.completed);
      if (filter === 'completed') return todos.filter((t) => t.completed);
      return todos;
    },
  };
}
