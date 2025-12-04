import type { SignalsApi, Signal, Computed } from './types';

export type Todo = {
  id: number;
  text: string;
  completed: boolean;
};

export type TodoListOptions = {
  initialTodos?: Todo[];
};

export type TodoListState = {
  todos: Signal<Todo[]>;
  allCompleted: Computed<boolean>;
  activeCount: Computed<number>;

  // Actions
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  toggleAll: () => void;
};

export const todoList =
  (api: SignalsApi) =>
  (options: TodoListOptions = {}): TodoListState => {
    const { signal, computed } = api;
    const { initialTodos = [] } = options;

    const todos = signal<Todo[]>(initialTodos);

    const allCompleted = computed(() => {
      const list = todos();
      return list.length > 0 && list.every((todo) => todo.completed);
    });

    const activeCount = computed(
      () => todos().filter((todo) => !todo.completed).length
    );

    return {
      todos,
      allCompleted,
      activeCount,

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
