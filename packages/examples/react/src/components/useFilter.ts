/**
 * Filter Behavior - React Version
 *
 * A simple filter for todo lists.
 * Used with useComponent to create isolated instances per React component.
 */
import type { Service } from '../service';
import type { Todo } from './useTodoList';

export type FilterType = 'all' | 'active' | 'completed';

export const useFilter = (api: Service) => {
  const currentFilter = api.signal<FilterType>('all');

  return {
    // Reactive state
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
};
