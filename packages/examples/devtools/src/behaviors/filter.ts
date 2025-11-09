/**
 * Filter Behavior - Framework Agnostic
 *
 * Provides filtering functionality for a todo list.
 * Demonstrates composition - this behavior works with any todo list.
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI, SignalFunction } from '../types';
import type { Todo } from './todo-list';

export type FilterType = 'all' | 'active' | 'completed';

export interface FilterAPI {
  currentFilter: SignalFunction<FilterType>;
  setFilter: (filter: FilterType) => void;
  filterTodos: (todos: Todo[]) => Todo[];
}

export const Filter = create((api: SignalsAPI) => (): FilterAPI => {
  const currentFilter = api.signal<FilterType>('all');

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
