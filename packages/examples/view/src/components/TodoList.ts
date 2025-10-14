/**
 * TodoList UI Component
 *
 * Uses @lattice/view primitives (el, elMap) to create a reactive UI
 * Uses the headless todo-list behavior for logic
 */

import type { LatticeViewAPI } from '../types';
import type { ElementRef, Reactive } from '@lattice/view';
import { createTodoList } from '../behaviors/todo-list';
import type { Todo } from '../behaviors/todo-list';

export function TodoList(api: LatticeViewAPI): ElementRef {
  const { el, elMap, signal } = api;

  // Create headless behavior
  const todoList = createTodoList(api);

  // Local UI state (input value)
  const inputValue = signal('');

  // Add todo handler
  const handleAdd = () => {
    const text = inputValue();
    if (text.trim()) {
      todoList.addTodo(text);
      inputValue('');
    }
  };

  // Handle enter key in input
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return el([
    'div',
    { className: 'example' },
    el(['h2', 'Todo List Example']),
    el(['p', 'Demonstrates reactive lists with elMap, filtering, and complex state.']),

    // Input section
    el([
      'div',
      el([
        'input',
        {
          className: 'todo-input',
          type: 'text',
          placeholder: 'What needs to be done?',
          value: inputValue,
          onInput: (e: Event) => {
            inputValue((e.target as HTMLInputElement).value);
          },
          onKeyDown: handleKeyDown,
        },
      ]),
      el(['button', { onClick: handleAdd }, 'Add Todo']),
    ]),

    // Filter buttons
    el([
      'div',
      { className: 'filter-buttons' },
      el([
        'button',
        {
          className: api.computed(() => (todoList.filter() === 'all' ? 'active' : '')),
          onClick: () => todoList.setFilter('all'),
        },
        'All',
      ]),
      el([
        'button',
        {
          className: api.computed(() => (todoList.filter() === 'active' ? 'active' : '')),
          onClick: () => todoList.setFilter('active'),
        },
        'Active',
      ]),
      el([
        'button',
        {
          className: api.computed(() => (todoList.filter() === 'completed' ? 'active' : '')),
          onClick: () => todoList.setFilter('completed'),
        },
        'Completed',
      ]),
    ]),

    // Todo list using elMap
    el([
      'div',
      { className: 'todo-list' },
      elMap(
        todoList.filteredTodos,
        (todoSignal: Reactive<Todo>) => {
          const todo = todoSignal();
          return el([
            'div',
            { className: 'todo-item' },
            el([
              'input',
              {
                type: 'checkbox',
                checked: api.computed(() => todoSignal().completed),
                onChange: () => todoList.toggleTodo(todo.id),
              },
            ]),
            el([
              'span',
              {
                className: api.computed(() =>
                  todoSignal().completed ? 'todo-text completed' : 'todo-text'
                ),
              },
              api.computed(() => todoSignal().text),
            ]),
            el([
              'button',
              {
                className: 'todo-remove',
                onClick: () => todoList.removeTodo(todo.id),
              },
              '×',
            ]),
          ]);
        },
        (todo: Todo) => todo.id
      ),
    ]),

    // Stats
    el([
      'div',
      { className: 'todo-stats' },
      'Active: ',
      todoList.activeCount,
      ' | Completed: ',
      todoList.completedCount,
      ' | ',
      el([
        'button',
        { onClick: () => todoList.clearCompleted() },
        'Clear Completed',
      ]),
    ]),
  ]);
}
