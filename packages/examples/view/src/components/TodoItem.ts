/**
 * TodoItem UI Component
 *
 * Renders a single todo item with checkbox, text, and remove button
 */

import type { Todo } from '../behaviors/useTodoList';
import { el, addEventListener } from '../service';

export const TodoItem = (
  todo: Todo,
  onToggle: (id: number) => void,
  onRemove: (id: number) => void
) => {
  // Create checkbox with event listener
  const checkbox = el('input').props({
    type: 'checkbox',
    checked: todo.completed,
  })()(addEventListener('change', () => onToggle(todo.id)));

  // Create remove button with event listener
  const removeBtn = el('button').props({ className: 'todo-remove' })('x')(
    addEventListener('click', () => onRemove(todo.id))
  );

  // Todo text with completed styling
  const todoText = el('span').props({
    className: todo.completed ? 'todo-text completed' : 'todo-text',
  })(todo.text);

  return el('div').props({ className: 'todo-item' })(checkbox, todoText, removeBtn);
};
