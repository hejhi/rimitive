/**
 * TodoList UI Component
 *
 * Uses @lattice/view primitives (el, map) to create a reactive UI
 * Uses the headless todo-list behavior for logic
 */

import { createTodoList } from '../behaviors/todo-list';
import { TodoItem } from './TodoItem';
import { create } from '../create';

export const TodoList = create(({ el, map, signal, computed, effect, on }) => () => {
  // Create headless behavior
  const todoList = createTodoList().create({ computed, effect, signal });

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
    on('input', (e) =>
      inputValue((e.target as HTMLInputElement).value)
    ),
    on('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    }),
  );

  // Create "Add Todo" button
  const addBtn = el('button', {})('Add Todo')(on('click', handleAdd))

  // Create filter buttons
  const allBtn = el(
    'button',
    {
      className: computed(() =>
        todoList.filter() === 'all' ? 'active' : ''
      ),
    },
  )('All')(on('click', () => todoList.setFilter('all')));

  const activeBtn = el(
    'button',
    {
      className: computed(() =>
        todoList.filter() === 'active' ? 'active' : ''
      ),
    },
  )('Active')(on('click', () => todoList.setFilter('active')));

  const completedBtn = el(
    'button',
    {
      className: computed(() =>
        todoList.filter() === 'completed' ? 'active' : ''
      ),
    },
  )('Completed')(on('click', () => todoList.setFilter('completed')));

  const clearBtn = el('button')('Clear Completed')(on('click', () => todoList.clearCompleted()));

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
