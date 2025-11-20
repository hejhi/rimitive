/**
 * TodoList Component - React Version
 *
 * Returns actual signal/computed functions for use with useSubscribe
 */

import type { SignalFunction } from '@lattice/signals/signal';
import type { ComputedFunction } from '@lattice/signals/computed';

export interface UseTodo {
  id: number;
  text: string;
  completed: boolean;
}

export interface UseTodoList {
  todos: SignalFunction<UseTodo[]>;
  allCompleted: ComputedFunction<boolean>;
  activeCount: ComputedFunction<number>;
  addTodo(text: string): void;
  toggleTodo(id: number): void;
  toggleAll(): void;
}

export function useTodoList(
  api: {
    signal: <T>(value: T) => SignalFunction<T>;
    computed: <T>(compute: () => T) => ComputedFunction<T>;
  },
  initialTodos: UseTodo[] = []
): UseTodoList {
  const todos = api.signal<UseTodo[]>(initialTodos);

  const allCompleted = api.computed(() => {
    const list = todos();
    return list.length > 0 && list.every((todo: UseTodo) => todo.completed);
  });

  const activeCount = api.computed(() => {
    return todos().filter((todo: UseTodo) => !todo.completed).length;
  });

  return {
    // Signals/Computed - for useSubscribe
    todos,
    allCompleted,
    activeCount,

    // Actions
    addTodo(text: string) {
      const newTodo: UseTodo = {
        id: Date.now(),
        text,
        completed: false,
      };
      todos([...todos(), newTodo]);
    },

    toggleTodo(id: number) {
      todos(
        todos().map((todo: UseTodo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    },

    toggleAll() {
      const shouldComplete = !allCompleted();
      todos(
        todos().map((todo: UseTodo) => ({ ...todo, completed: shouldComplete }))
      );
    },
  };
}
