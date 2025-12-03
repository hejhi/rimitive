/**
 * useFilter - Portable Filter Behavior
 *
 * A simple filter for todo lists.
 * Framework-agnostic - works with any signals implementation.
 *
 * @example
 * ```ts
 * // With Lattice signals
 * const filter = useFilter({ signal, computed, effect })();
 * const filtered = filter.filterTodos(todos);
 *
 * // With React (via createHook)
 * const useFilterHook = createHook(useFilter);
 * const filter = useFilterHook();
 * ```
 */
import type { SignalsApi, Signal } from './types';
import type { Todo } from './useTodoList';

export type FilterType = 'all' | 'active' | 'completed';

export interface FilterState {
  /** Current filter type */
  currentFilter: Signal<FilterType>;

  /** Set the filter type */
  setFilter: (filter: FilterType) => void;

  /** Filter a list of todos based on current filter */
  filterTodos: (todos: Todo[]) => Todo[];
}

/**
 * Creates a portable filter behavior
 *
 * @param api - Signals API (signal, computed, effect)
 * @returns Factory function that creates filter state
 */
export const useFilter =
  (api: SignalsApi) =>
  (): FilterState => {
    const { signal } = api;

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
