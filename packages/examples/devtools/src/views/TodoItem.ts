/**
 * TodoItem View Component
 *
 * Renders an individual todo item with checkbox and completion styling.
 * Uses the create() pattern.
 */

import { create } from '@lattice/view/component';
import type { Todo } from '../behaviors/todo-list';

export const TodoItem = create(
  ({ el, on, computed }) =>
    (
      todoSignal: () => Todo,
      toggleTodo: (id: number) => void
    ) => {
      const checkbox = el('input', {
        type: 'checkbox',
        checked: computed(() => todoSignal().completed)
      })()(
        on('change', () => toggleTodo(todoSignal().id))
      );

      return el('li', {
        className: computed(() => todoSignal().completed ? 'todo-item completed' : 'todo-item')
      })(
        checkbox,
        el('span')(computed(() => todoSignal().text))
      );
    }
);
