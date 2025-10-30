/**
 * TodoList UI Component
 *
 * Uses @lattice/view primitives (el, map) to create a reactive UI
 * Uses the headless todo-list behavior for logic
 */

import type { LatticeViewAPI } from '../types';
import { createTodoList } from '../behaviors/todo-list';
import { TodoItem } from './TodoItem';

export function TodoList(api: LatticeViewAPI) {
  const { el, map, signal } = api;

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

  // Create input with event listeners
  const todoInput = el([
    'input',
    {
      className: 'todo-input',
      type: 'text',
      placeholder: 'What needs to be done?',
      value: inputValue,
    },
  ])((input) => {
    const cleanup1 = api.on(input, 'input', (e) =>
      inputValue((e.target as HTMLInputElement).value)
    );
    const cleanup2 = api.on(input, 'keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    });
    return () => {
      cleanup1();
      cleanup2();
    };
  });

  // Create "Add Todo" button
  const addBtn = el(['button', {}, 'Add Todo'])((btn) =>
    api.on(btn, 'click', handleAdd)
  );

  // Create filter buttons
  const allBtn = el([
    'button',
    {
      className: api.computed(() =>
        todoList.filter() === 'all' ? 'active' : ''
      ),
    },
    'All',
  ])((btn) => api.on(btn, 'click', () => todoList.setFilter('all')));

  const activeBtn = el([
    'button',
    {
      className: api.computed(() =>
        todoList.filter() === 'active' ? 'active' : ''
      ),
    },
    'Active',
  ])((btn) => api.on(btn, 'click', () => todoList.setFilter('active')));

  const completedBtn = el([
    'button',
    {
      className: api.computed(() =>
        todoList.filter() === 'completed' ? 'active' : ''
      ),
    },
    'Completed',
  ])((btn) => api.on(btn, 'click', () => todoList.setFilter('completed')));

  // Create "Clear Completed" button
  const clearBtn = el(['button', 'Clear Completed'])((btn) =>
    api.on(btn, 'click', () => todoList.clearCompleted())
  );

  return el([
    'div',
    { className: 'example' },
    el(['h2', 'Todo List Example']),
    el([
      'p',
      'Demonstrates reactive lists with map, filtering, and complex state.',
    ]),

    // Input section
    el(['div', todoInput, addBtn]),

    // Filter buttons
    el([
      'div',
      { className: 'filter-buttons' },
      allBtn,
      activeBtn,
      completedBtn,
    ]),

    // Todo list using map with composed TodoItem component
    el([
      'div',
      { className: 'todo-list' },
      map(
        todoList.filteredTodos,
        (todoSignal) =>
          TodoItem(
            api,
            todoSignal,
            (id) => todoList.toggleTodo(id),
            (id) => todoList.removeTodo(id)
          ),
        (todo) => todo.id // Key function for immutable updates
      ),
    ]),

    // Stats
    el([
      'div',
      { className: 'todo-stats' },
      // UI-level computed concerns
      api.computed(
        () =>
          `Active: ${todoList.activeCount()} | Completed: ${todoList.completedCount()} | `
      ),
      clearBtn,
    ]),
  ]);
}
