/**
 * TodoList Component
 *
 * Manages a list of todos with add, toggle, and toggleAll functionality.
 * Demonstrates working with arrays in signals and computed values.
 */

import type { Writable, Readable } from '@lattice/signals/types';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export interface TodoListAPI {
  todos(): Todo[];
  allCompleted(): boolean;
  activeCount(): number;
  addTodo(text: string): void;
  toggleTodo(id: number): void;
  toggleAll(): void;
}

export function createTodoList(
  api: {
    signal: <T>(value: T) => Writable<T>;
    computed: <T>(compute: () => T) => Readable<T>;
  },
  initialTodos: Todo[] = []
): TodoListAPI {
  const todos = api.signal<Todo[]>(initialTodos);

  const allCompleted = api.computed(() => {
    const list = todos();
    return list.length > 0 && list.every((todo: Todo) => todo.completed);
  });

  const activeCount = api.computed(() => {
    return todos().filter((todo: Todo) => !todo.completed).length;
  });

  return {
    // Getters
    todos: () => todos(),
    allCompleted: () => allCompleted(),
    activeCount: () => activeCount(),

    // Actions
    addTodo(text: string) {
      const newTodo: Todo = {
        id: Date.now(),
        text,
        completed: false,
      };
      todos([...todos(), newTodo]);
    },

    toggleTodo(id: number) {
      todos(
        todos().map((todo: Todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    },

    toggleAll() {
      const shouldComplete = !allCompleted();
      todos(todos().map((todo: Todo) => ({ ...todo, completed: shouldComplete })));
    },
  };
}
