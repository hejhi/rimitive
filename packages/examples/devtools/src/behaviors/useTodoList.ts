/**
 * TodoList Behavior - Framework Agnostic
 *
 * Manages a list of todos with add, toggle, and toggleAll functionality.
 * Demonstrates working with arrays in signals and computed values.
 */
import type { Service } from '../service';

export type Todo = {
  id: number;
  text: string;
  completed: boolean;
};

export const useTodoList =
  (svc: Service) =>
  (initialTodos: Todo[] = []) => {
    const todos = svc.signal<Todo[]>(initialTodos);

    const allCompleted = svc.computed(() => {
      const list = todos();
      return list.length > 0 && list.every((todo: Todo) => todo.completed);
    });

    const activeCount = svc.computed(() => {
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
  };

export type UseTodoList = ReturnType<ReturnType<typeof useTodoList>>;
