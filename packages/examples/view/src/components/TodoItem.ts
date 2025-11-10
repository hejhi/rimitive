/**
 * TodoItem UI Component
 *
 * Renders a single todo item with checkbox, text, and remove button
 */

import type { Reactive } from '@lattice/view/types';
import type { Todo } from '../behaviors/todo-list';
import { create } from '../create';

export const TodoItem = create(
  ({ el, on, computed }) =>
    (
      todoSignal: Reactive<Todo>,
      onToggle: (id: number) => void,
      onRemove: (id: number) => void
    ) => {
      const todo = todoSignal();

      // Create checkbox with event listener
      const checkbox = el('input', {
        type: 'checkbox',
        checked: computed(() => todoSignal().completed),
      })()(on('change', () => onToggle(todo.id)));

      // Create remove button with event listener
      const removeBtn = el('button', { className: 'todo-remove' })('x')(
        on('click', () => onRemove(todo.id))
      );

      // Conditionally render completed vs active todo text using computed
      const todoText = el('span', {
        className: computed(() =>
          todoSignal().completed ? 'todo-text completed' : 'todo-text'
        ),
      })(computed(() => todoSignal().text));

      return el('div', { className: 'todo-item' })(
        checkbox,
        todoText,
        removeBtn
      );
    }
);
