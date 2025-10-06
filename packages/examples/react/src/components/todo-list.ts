/**
 * TodoList Component - React Version
 *
 * Returns actual signal/computed functions for use with useSubscribe
 */

import type { SignalFunction } from '@lattice/signals/signal';
import type { ComputedFunction } from '@lattice/signals/computed';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export interface TodoListAPI {
  todos: SignalFunction<Todo[]>;
  allCompleted: ComputedFunction<boolean>;
  activeCount: ComputedFunction<number>;
  addTodo(text: string): void;
  toggleTodo(id: number): void;
  toggleAll(): void;
}

export function createTodoList(
  api: {
    signal: <T>(value: T) => SignalFunction<T>;
    computed: <T>(compute: () => T) => ComputedFunction<T>;
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
    // Signals/Computed - for useSubscribe
    todos,
    allCompleted,
    activeCount,

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
