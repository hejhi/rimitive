/**
 * Filter Component
 *
 * Provides filtering functionality for a todo list.
 * Demonstrates composition - this component works with any todo list.
 */

import type { Todo } from './todo-list';

export type FilterType = 'all' | 'active' | 'completed';

export interface FilterAPI {
  currentFilter(): FilterType;
  setFilter(filter: FilterType): void;
  filterTodos(todos: Todo[]): Todo[];
}

export function createFilter(api: {
  signal: <T>(value: T) => any;
  computed: <T>(compute: () => T) => any;
}): FilterAPI {
  const currentFilter = api.signal<FilterType>('all');

  return {
    // Getters
    currentFilter: () => currentFilter(),

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
