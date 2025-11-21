/**
 * TodoItem View Component
 *
 * Renders an individual todo item with checkbox and completion styling.
 * Uses the create() pattern.
 */

import { useSvc } from '../service';
import type { Todo } from '../behaviors/useTodoList';

export const TodoItem = useSvc(
  ({ el, addEventListener, computed }) =>
    (todoSignal: () => Todo, toggleTodo: (id: number) => void) => {
      const checkbox = el('input', {
        type: 'checkbox',
        checked: computed(() => todoSignal().completed),
      })()(addEventListener('change', () => toggleTodo(todoSignal().id)));

      return el('li', {
        className: computed(() =>
          todoSignal().completed ? 'todo-item completed' : 'todo-item'
        ),
      })(checkbox, el('span')(computed(() => todoSignal().text)));
    }
);
