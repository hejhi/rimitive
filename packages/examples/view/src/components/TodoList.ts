/**
 * TodoList UI Component
 *
 * Uses @lattice/view primitives (el, map) to create a reactive UI
 * Uses the headless todo-list behavior for logic
 */

import { createTodoList } from '../behaviors/todo-list';
import { TodoItem } from './TodoItem';
import { create } from '../api';

export const TodoList = create(({ el, map, signal, computed, addEventListener }) => () => {
  // Create headless behavior
  const todoList = createTodoList({ computed, signal });

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
    addEventListener('input', (e) =>
      inputValue((e.target as HTMLInputElement).value)
    ),
    addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    }),
  );

  // Create "Add Todo" button
  const addBtn = el('button', {})('Add Todo')(addEventListener('click', handleAdd))

  // Create filter buttons
  const allBtn = el(
    'button',
    {
      className: computed(() =>
        todoList.filter() === 'all' ? 'active' : ''
      ),
    },
  )('All')(addEventListener('click', () => todoList.setFilter('all')));

  const activeBtn = el(
    'button',
    {
      className: computed(() =>
        todoList.filter() === 'active' ? 'active' : ''
      ),
    },
  )('Active')(addEventListener('click', () => todoList.setFilter('active')));

  const completedBtn = el(
    'button',
    {
      className: computed(() =>
        todoList.filter() === 'completed' ? 'active' : ''
      ),
    },
  )('Completed')(addEventListener('click', () => todoList.setFilter('completed')));

  const clearBtn = el('button')('Clear Completed')(addEventListener('click', () => todoList.clearCompleted()));

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
            todoSignal,
            (id) => todoList.toggleTodo(id),
            (id) => todoList.removeTodo(id)
          )
      ),
    ),

    // Stats
    el('div', { className: 'todo-stats' })(
      computed(
        () =>
          `Active: ${todoList.activeCount()} | Completed: ${todoList.completedCount()} | `
      ),
      clearBtn,
    ),
  );
});
