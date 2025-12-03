/**
 * TodoItem View Component
 *
 * Renders an individual todo item with checkbox and completion styling.
 */
import { el, on } from '../service';
import type { Todo } from '../behaviors/useTodoList';

export const TodoItem = (todo: Todo, toggleTodo: (id: number) => void) => {
  const checkbox = el('input')
    .props({
      type: 'checkbox',
      checked: todo.completed,
    })
    .ref(on('change', () => toggleTodo(todo.id)))();

  return el('li').props({
    className: todo.completed ? 'todo-item completed' : 'todo-item',
  })(checkbox, el('span')(todo.text));
};
