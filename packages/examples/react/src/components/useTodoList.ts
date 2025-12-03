/**
 * useTodoList - Portable TodoList Behavior
 *
 * A todo list with computed values for filtering and counting.
 * Framework-agnostic - works with any signals implementation.
 *
 * @example
 * ```ts
 * // With Lattice signals
 * const todoList = useTodoList({ signal, computed, effect })({
 *   initialTodos: [{ id: 1, text: 'Learn Lattice', completed: false }]
 * });
 *
 * // With React (via createHook)
 * const useTodoListHook = createHook(useTodoList);
 * const todoList = useTodoListHook({ initialTodos: [...] });
 * ```
 */
import type { SignalsApi, Signal, Computed } from './types';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export interface UseTodoListOptions {
  /** Initial list of todos */
  initialTodos?: Todo[];
}

export interface TodoListState {
  /** All todos */
  todos: Signal<Todo[]>;
  /** Whether all todos are completed */
  allCompleted: Computed<boolean>;
  /** Number of active (not completed) todos */
  activeCount: Computed<number>;

  /** Add a new todo */
  addTodo: (text: string) => void;
  /** Toggle a todo's completed state */
  toggleTodo: (id: number) => void;
  /** Toggle all todos' completed state */
  toggleAll: () => void;
}

/**
 * Creates a portable todo list behavior
 *
 * @param api - Signals API (signal, computed, effect)
 * @returns Factory function that creates todo list state
 */
export const useTodoList =
  (api: SignalsApi) =>
  (options: UseTodoListOptions = {}): TodoListState => {
    const { signal, computed } = api;
    const { initialTodos = [] } = options;

    const todos = signal<Todo[]>(initialTodos);

    const allCompleted = computed(() => {
      const list = todos();
      return list.length > 0 && list.every((todo) => todo.completed);
    });

    const activeCount = computed(() =>
      todos().filter((todo) => !todo.completed).length
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
