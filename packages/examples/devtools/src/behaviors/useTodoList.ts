/**
 * TodoList Behavior - Framework Agnostic
 *
 * Manages a list of todos with add, toggle, and toggleAll functionality.
 * Demonstrates working with arrays in signals and computed values.
 */

import { useSvc } from '../service';
import type { SignalFunction, ComputedFunction } from '../types';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export interface UseTodoList {
  todos: SignalFunction<Todo[]>;
  allCompleted: ComputedFunction<boolean>;
  activeCount: ComputedFunction<number>;
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  toggleAll: () => void;
}

export const useTodoList = useSvc(
  ({ signal, computed }) =>
    (initialTodos: Todo[] = []) => {
      const todos = signal<Todo[]>(initialTodos);

      const allCompleted = computed(() => {
        const list = todos();
        return list.length > 0 && list.every((todo: Todo) => todo.completed);
      });

      const activeCount = computed(() => {
        return todos().filter((todo: Todo) => !todo.completed).length;
      });

      return {
        // Reactive state - expose signals directly
        todos,
        allCompleted,
        activeCount,

        // Actions - update state
        addTodo: (text: string) => {
          const newTodo: Todo = {
            id: Date.now(),
            text,
            completed: false,
          };
          todos([...todos(), newTodo]);
        },

        toggleTodo: (id: number) => {
          todos(
            todos().map((todo: Todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
          );
        },

        toggleAll: () => {
          const shouldComplete = !allCompleted();
          todos(
            todos().map((todo: Todo) => ({
              ...todo,
              completed: shouldComplete,
            }))
          );
        },
      };
    }
);
