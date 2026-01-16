/**
 * TodoItem View Component
 *
 * Renders an individual todo item with checkbox and completion styling.
 */
import { el, computed } from '../service';
import type { Todo } from '../behaviors/useTodoList';

export const TodoItem = (
  todo: () => Todo,
  toggleTodo: (id: number) => void
) => {
  const isCompleted = computed(() => todo().completed);

  return el('li').props({
    className: computed(() =>
      isCompleted() ? 'todo-item completed' : 'todo-item'
    ),
  })(
    el('input').props({
      type: 'checkbox',
      checked: isCompleted,
      onchange: () => toggleTodo(todo().id),
    })(),
    el('span')(computed(() => todo().text))
  );
};
