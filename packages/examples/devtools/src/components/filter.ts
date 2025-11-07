/**
 * Filter Component
 *
 * Provides filtering functionality for a todo list.
 * Demonstrates composition - this component works with any todo list.
 */

import type { Writable, Readable } from '@lattice/signals/types';
import type { Todo } from './todo-list';

export type FilterType = 'all' | 'active' | 'completed';

export interface FilterAPI {
  currentFilter: () => FilterType;
  setFilter: (filter: FilterType) => void;
  filterTodos: (todos: Todo[]) => Todo[];
}

export function createFilter(api: {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(compute: () => T) => Readable<T>;
}): FilterAPI {
  const currentFilter = api.signal<FilterType>('all');

  return {
    // Getters
    currentFilter,

    // Actions
    setFilter: currentFilter,

    // Utility - filter any todo list
    filterTodos: (todos: Todo[]): Todo[] => {
      const filter = currentFilter();
      if (filter === 'active') return todos.filter((t) => !t.completed);
      if (filter === 'completed') return todos.filter((t) => t.completed);
      return todos;
    },
  };
}
