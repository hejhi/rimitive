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
  const todoInput = el(
    'input',
    {
      className: 'todo-input',
      type: 'text',
      placeholder: 'What needs to be done?',
      value: inputValue,
    },
  )()(
    api.on('input', (e) =>
      inputValue((e.target as HTMLInputElement).value)
    ),
    api.on('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    }),
  );

  // Create "Add Todo" button
  const addBtn = el('button', {})('Add Todo')(api.on('click', handleAdd))

  // Create filter buttons
  const allBtn = el(
    'button',
    {
      className: api.computed(() =>
        todoList.filter() === 'all' ? 'active' : ''
      ),
    },
  )('All')(api.on('click', () => todoList.setFilter('all')));

  const activeBtn = el(
    'button',
    {
      className: api.computed(() =>
        todoList.filter() === 'active' ? 'active' : ''
      ),
    },
  )('Active')(api.on('click', () => todoList.setFilter('active')));

  const completedBtn = el(
    'button',
    {
      className: api.computed(() =>
        todoList.filter() === 'completed' ? 'active' : ''
      ),
    },
  )('Completed')(api.on('click', () => todoList.setFilter('completed')));

  const clearBtn = el('button')('Clear Completed')(api.on('click', () => todoList.clearCompleted()));

  return el(
    'div',
    { className: 'example' },
  )(
    el('h2')('Todo List Example'),
    el('p')(
      'Demonstrates reactive lists with map, filtering, and complex state.',
    ),

    // Input section
    el('div')(todoInput, addBtn),

    // Filter buttons
    el('div', { className: 'filter-buttons' })(
      allBtn,
      activeBtn,
      completedBtn,
    ),

    // Todo list using map with composed TodoItem component
    el('div', { className: 'todo-list' })(
      map(
        todoList.filteredTodos,
        (todo) => todo.id // Key function for immutable updates
      )(
        (todoSignal) =>
          TodoItem(
            api,
            todoSignal,
            (id) => todoList.toggleTodo(id),
            (id) => todoList.removeTodo(id)
          )
      ),
    ),

    // Stats
    el('div', { className: 'todo-stats' })(
      api.computed(
        () =>
          `Active: ${todoList.activeCount()} | Completed: ${todoList.completedCount()} | `
      ),
      clearBtn,
    ),
  );
}
