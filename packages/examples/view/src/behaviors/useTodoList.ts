/**
 * TodoList Behavior - Framework Agnostic
 *
 * Component Pattern (see COMPONENT_PATTERN.md)
 * This is a headless component - pure logic with no UI concerns.
 * Can be used with any signals implementation (Lattice, Solid, Preact Signals, etc.)
 */

import { Signals } from '../api';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export type FilterType = 'all' | 'active' | 'completed';

export const useTodoList = ({ signal, computed }: Pick<Signals, 'signal' | 'computed'>) => {
  let nextId = 1;
  const todos = signal<Todo[]>([]);
  const filter = signal<FilterType>('all');

  // Derived state
  const filteredTodos = computed(() => {
    const currentTodos = todos();
    const currentFilter = filter();

    if (currentFilter === 'active') return currentTodos.filter((t: Todo) => !t.completed);
    if (currentFilter === 'completed') return currentTodos.filter((t: Todo) => t.completed);

    return currentTodos;
  });

  const activeCount = computed(
    () => todos().filter((t: Todo) => !t.completed).length
  );

  const completedCount = computed(
    () => todos().filter((t: Todo) => t.completed).length
  );

  return {
    // Reactive state - expose signals directly
    todos,
    filteredTodos,
    filter,
    activeCount,
    completedCount,

    // Actions - update state
    addTodo: (text: string) => {
      if (text.trim()) {
        todos([...todos(), { id: nextId++, text, completed: false }]);
      }
    },

    toggleTodo: (id: number) => {
      todos(
        todos().map((todo: Todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    },

    removeTodo: (id: number) => {
      todos(todos().filter((todo: Todo) => todo.id !== id));
    },

    setFilter: (newFilter: FilterType) => {
      filter(newFilter);
    },

    clearCompleted: () => {
      todos(todos().filter((todo: Todo) => !todo.completed));
    },
  };
};
