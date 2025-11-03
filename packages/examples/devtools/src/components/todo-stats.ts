/**
 * TodoStats Component
 *
 * Demonstrates dependency injection - this component depends on a TodoListAPI.
 * It doesn't create its own todo list, it works with any existing one.
 *
 * This shows composition through dependencies rather than creating everything internally.
 */

import type { Readable } from '@lattice/signals/types';
import type { TodoListAPI, Todo } from './todo-list';

export interface TodoStatsAPI {
  total: () => number;
  active: () => number;
  completed: () => number;
  completionRate: () => number;
}

/**
 * Create a stats component that depends on an existing TodoList
 */
export function createTodoStats(
  computed: <T>(compute: () => T) => Readable<T>,
  { todos, activeCount }: Pick<TodoListAPI, 'todos' | 'activeCount'>
): TodoStatsAPI {
  // These computed values depend on the injected todoList
  const total = computed(() => todos().length);
  const active = computed(() => activeCount());
  const completed = computed(() => {
    return todos().filter((todo: Todo) => todo.completed).length;
  });
  const completionRate = computed(() => {
    const t = total();
    return t === 0 ? 0 : (completed() / t) * 100;
  });

  return {
    total: () => total(),
    active: () => active(),
    completed: () => completed(),
    completionRate: () => completionRate(),
  };
}
