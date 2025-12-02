/**
 * TodoItem View Component
 *
 * Renders an individual todo item with checkbox and completion styling.
 * Uses the create() pattern.
 */

import { useSvc } from '../service';
import type { Todo } from '../behaviors/useTodoList';

export const TodoItem = useSvc(
  ({ el, addEventListener }) =>
    (todo: Todo, toggleTodo: (id: number) => void) => {
      const checkbox = el('input').props({
        type: 'checkbox',
        checked: todo.completed,
      })()(addEventListener('change', () => toggleTodo(todo.id)));

      return el('li').props({
        className: todo.completed ? 'todo-item completed' : 'todo-item',
      })(checkbox, el('span')(todo.text));
    }
);
