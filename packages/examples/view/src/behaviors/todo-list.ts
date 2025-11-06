/**
 * TodoList Behavior - Framework Agnostic
 *
 * Component Pattern (see COMPONENT_PATTERN.md)
 * This is a headless component - pure logic with no UI concerns.
 * Can be used with any signals implementation (Lattice, Solid, Preact Signals, etc.)
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI, SignalFunction, ComputedFunction } from '../types';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export type FilterType = 'all' | 'active' | 'completed';

export interface TodoListAPI {
  todos: SignalFunction<Todo[]>;
  filteredTodos: ComputedFunction<Todo[]>;
  filter: SignalFunction<FilterType>;
  activeCount: ComputedFunction<number>;
  completedCount: ComputedFunction<number>;
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  removeTodo: (id: number) => void;
  setFilter: (filter: FilterType) => void;
  clearCompleted: () => void;
}

export const createTodoList = create((api: SignalsAPI) => (): TodoListAPI => {
  let nextId = 1;
  const todos = api.signal<Todo[]>([]);
  const filter = api.signal<FilterType>('all');

  // Derived state
  const filteredTodos = api.computed(() => {
    const currentTodos = todos();
    const currentFilter = filter();

    if (currentFilter === 'active') {
      return currentTodos.filter((t: Todo) => !t.completed);
    }
    if (currentFilter === 'completed') {
      return currentTodos.filter((t: Todo) => t.completed);
    }
    return currentTodos;
  });

  const activeCount = api.computed(() =>
    todos().filter((t: Todo) => !t.completed).length
  );

  const completedCount = api.computed(() =>
    todos().filter((t: Todo) => t.completed).length
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
      todos(todos().map((todo: Todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ));
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
});
