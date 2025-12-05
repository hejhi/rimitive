import type { SignalsSvc, Signal } from './types';
import type { Todo } from './todoList';

export type FilterType = 'all' | 'active' | 'completed';

export type FilterState = {
  currentFilter: Signal<FilterType>;
  setFilter: (filter: FilterType) => void;
  filterTodos: (todos: Todo[]) => Todo[];
};

export const filter =
  ({ signal }: SignalsSvc) =>
  () => {
    const currentFilter = signal<FilterType>('all');

    return {
      currentFilter,

      setFilter: (filter: FilterType) => currentFilter(filter),

      filterTodos: (todos: Todo[]): Todo[] => {
        const filter = currentFilter();
        if (filter === 'active') return todos.filter((t) => !t.completed);
        if (filter === 'completed') return todos.filter((t) => t.completed);
        return todos;
      },
    };
  };
