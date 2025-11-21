/**
 * Filter Behavior - Framework Agnostic
 *
 * Provides filtering functionality for a todo list.
 * Demonstrates composition - this behavior works with any todo list.
 */

import { useSvc } from '../service';
import type { Todo } from './useTodoList';

export type FilterType = 'all' | 'active' | 'completed';

export const useFilter = useSvc(({ signal }) => () => {
  const currentFilter = signal<FilterType>('all');

  return {
    // Reactive state - expose signal directly
    currentFilter,

    // Actions
    setFilter: (filter: FilterType) => currentFilter(filter),

    // Utility - filter any todo list
    filterTodos: (todos: Todo[]): Todo[] => {
      const filter = currentFilter();
      if (filter === 'active') return todos.filter((t) => !t.completed);
      if (filter === 'completed') return todos.filter((t) => t.completed);
      return todos;
    },
  };
});
