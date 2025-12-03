/**
 * TodoList Behavior - React Version
 *
 * A todo list with computed values for filtering and counting.
 * Used with useComponent to create isolated instances per React component.
 */
import type { Service } from '../service';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export const useTodoList = (api: Service, initialTodos: Todo[] = []) => {
  const todos = api.signal<Todo[]>(initialTodos);

  const allCompleted = api.computed(() => {
    const list = todos();
    return list.length > 0 && list.every((todo) => todo.completed);
  });

  const activeCount = api.computed(() =>
    todos().filter((todo) => !todo.completed).length
  );

  return {
    // Reactive state
    todos,
    allCompleted,
    activeCount,

    // Actions
    addTodo: (text: string) => {
      todos([...todos(), { id: Date.now(), text, completed: false }]);
    },

    toggleTodo: (id: number) => {
      todos(
        todos().map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    },

    toggleAll: () => {
      const shouldComplete = !allCompleted();
      todos(todos().map((todo) => ({ ...todo, completed: shouldComplete })));
    },
  };
};
