/**
 * TodoItem UI Component
 *
 * Renders a single todo item with checkbox, text, and remove button
 */

import type { LatticeViewAPI } from '../types';
import type { ElementRef, Reactive } from '@lattice/view/types';
import type { Todo } from '../behaviors/todo-list';

export function TodoItem(
  api: LatticeViewAPI,
  todoSignal: Reactive<Todo>,
  onToggle: (id: number) => void,
  onRemove: (id: number) => void
): ElementRef {
  const { el } = api;
  const todo = todoSignal();

  // Create checkbox with event listener
  const checkbox = el([
    'input',
    {
      type: 'checkbox',
      checked: api.computed(() => todoSignal().completed),
    },
  ]);
  checkbox((el) => {
    const cb = el as HTMLInputElement;
    const handler = () => onToggle(todo.id);
    cb.addEventListener('change', handler);
    return () => cb.removeEventListener('change', handler);
  });

  // Create remove button with event listener
  const removeBtn = el(['button', { className: 'todo-remove' }, '×']);
  removeBtn((el) => {
    const btn = el as HTMLElement;
    const handler = () => onRemove(todo.id);
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  return el([
    'div',
    { className: 'todo-item' },
    checkbox,
    el([
      'span',
      {
        className: api.computed(() =>
          todoSignal().completed ? 'todo-text completed' : 'todo-text'
        ),
      },
      api.computed(() => todoSignal().text),
    ]),
    removeBtn,
  ]);
}
