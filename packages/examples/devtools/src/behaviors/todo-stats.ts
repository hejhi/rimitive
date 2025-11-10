/**
 * TodoStats Behavior - Framework Agnostic
 *
 * Demonstrates dependency injection - this behavior depends on a TodoListAPI.
 * It doesn't create its own todo list, it works with any existing one.
 *
 * This shows composition through dependencies rather than creating everything internally.
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI } from '../types';
import type { TodoListAPI } from './todo-list';

/**
 * Create a stats behavior that depends on an existing TodoList
 */
export const TodoStats = create(({ computed }: SignalsAPI) => (
  { todos, activeCount }: Pick<TodoListAPI, 'todos' | 'activeCount'>
) => {
  // These computed values depend on the injected todoList
  const total = computed(() => todos().length);
  const active = computed(() => activeCount());
  const completed = computed(() => {
    return todos().filter((todo) => todo.completed).length;
  });
  const completionRate = computed(() => {
    const t = total();
    return t === 0 ? 0 : (completed() / t) * 100;
  });

  return {
    total,
    active,
    completed,
    completionRate,
  };
});
