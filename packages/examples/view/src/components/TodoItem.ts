/**
 * TodoItem UI Component
 *
 * Renders a single todo item with checkbox, text, and remove button.
 * Receives a signal wrapping the todo, enabling reactive updates
 * without recreating the element.
 */

import type { Reactive } from '@lattice/view/types';
import type { Todo } from '../behaviors/useTodoList';
import { el, computed } from '../service';

export const TodoItem = (
  todoSignal: Reactive<Todo>,
  onToggle: (id: number) => void,
  onRemove: (id: number) => void
) => {
  // Read initial value for event handlers (id doesn't change)
  const todo = todoSignal();

  // Create checkbox with reactive checked state
  const checkbox = el('input').props({
    type: 'checkbox',
    checked: computed(() => todoSignal().completed),
    onchange: () => onToggle(todo.id),
  })();

  // Create remove button with event listener
  const removeBtn = el('button').props({
    className: 'todo-remove',
    onclick: () => onRemove(todo.id),
  })('x');

  // Todo text with reactive completed styling
  const todoText = el('span').props({
    className: computed(() =>
      todoSignal().completed ? 'todo-text completed' : 'todo-text'
    ),
  })(computed(() => todoSignal().text));

  return el('div').props({ className: 'todo-item' })(
    checkbox,
    todoText,
    removeBtn
  );
};
