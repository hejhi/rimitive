/**
 * TodoStats Behavior - Framework Agnostic
 *
 * Demonstrates dependency injection - this behavior depends on a TodoListAPI.
 * It doesn't create its own todo list, it works with any existing one.
 *
 * This shows composition through dependencies rather than creating everything internally.
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI, ComputedFunction } from '../types';
import type { TodoListAPI, Todo } from './todo-list';

export interface TodoStatsAPI {
  total: ComputedFunction<number>;
  active: ComputedFunction<number>;
  completed: ComputedFunction<number>;
  completionRate: ComputedFunction<number>;
}

/**
 * Create a stats behavior that depends on an existing TodoList
 */
export const TodoStats = create((api: SignalsAPI) => (
  { todos, activeCount }: Pick<TodoListAPI, 'todos' | 'activeCount'>
): TodoStatsAPI => {
  // These computed values depend on the injected todoList
  const total = api.computed(() => todos().length);
  const active = api.computed(() => activeCount());
  const completed = api.computed(() => {
    return todos().filter((todo: Todo) => todo.completed).length;
  });
  const completionRate = api.computed(() => {
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
