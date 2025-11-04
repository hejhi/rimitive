/**
 * TodoItem UI Component
 *
 * Renders a single todo item with checkbox, text, and remove button
 */

import type { LatticeViewAPI } from '@lattice/view/component';
import type { Reactive } from '@lattice/view/types';
import type { Todo } from '../behaviors/todo-list';

export function TodoItem(
  api: LatticeViewAPI,
  todoSignal: Reactive<Todo>,
  onToggle: (id: number) => void,
  onRemove: (id: number) => void
) {
  const { el } = api;
  const todo = todoSignal();

  // Create checkbox with event listener
  const checkbox = el(
    'input',
    {
      type: 'checkbox',
      checked: api.computed(() => todoSignal().completed),
    },
  )()(
      api.on('change', () => onToggle(todo.id))
    );

  // Create remove button with event listener
  const removeBtn = el('button', { className: 'todo-remove' })('x') (
    api.on('click', () => onRemove(todo.id))
  );

  // Conditionally render completed vs active todo text using computed
  const todoText = el(
    'span',
    {
      className: api.computed(() => todoSignal().completed ? 'todo-text completed' : 'todo-text'),
    }
  )(
    api.computed(() => todoSignal().text)
  );

  return el('div', { className: 'todo-item' })(checkbox, todoText, removeBtn);
}
