/**
 * TodoItem UI Component
 *
 * Renders a single todo item with checkbox, text, and remove button
 */

import type { LatticeViewAPI } from '../types';
import type { Reactive } from '@lattice/view/types';
import type { Todo } from '../behaviors/todo-list';
import { on } from '@lattice/view/on';

export function TodoItem(
  api: LatticeViewAPI,
  todoSignal: Reactive<Todo>,
  onToggle: (id: number) => void,
  onRemove: (id: number) => void
) {
  const { el, match } = api;
  const todo = todoSignal();

  // Create checkbox with event listener
  const checkbox = el([
    'input',
    {
      type: 'checkbox',
      checked: api.computed(() => todoSignal().completed),
    },
  ]);
  checkbox((el) => on(el, 'change', () => onToggle(todo.id)));

  // Create remove button with event listener
  const removeBtn = el(['button', { className: 'todo-remove' }, 'x']);
  removeBtn((el) => on(el, 'click', () => onRemove(todo.id)));

  return el([
    'div',
    { className: 'todo-item' },
    checkbox,
    // Use match() to conditionally render completed vs active todo text
    match(
      api.computed(() => todoSignal().completed),
      (completed: boolean) =>
        completed
          ? el([
              'span',
              { className: 'todo-text completed' },
              api.computed(() => todoSignal().text),
            ])
          : el([
              'span',
              { className: 'todo-text' },
              api.computed(() => todoSignal().text),
            ])
    ),
    removeBtn,
  ]);
}
