/**
 * TodoList UI Component
 *
 * Uses @lattice/view primitives (el, elMap) to create a reactive UI
 * Uses the headless todo-list behavior for logic
 */

import type { LatticeViewAPI } from '../types';
import type { ElementRef, Reactive } from '@lattice/view/types';
import { createTodoList } from '../behaviors/todo-list';
import type { Todo } from '../behaviors/todo-list';
import { TodoItem } from './TodoItem';

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

  // Create input with event listeners
  const todoInput = el([
    'input',
    {
      className: 'todo-input',
      type: 'text',
      placeholder: 'What needs to be done?',
      value: inputValue,
    },
  ]);
  todoInput((el) => {
    const input = el as HTMLInputElement;
    const handleInput = (e: Event) => {
      inputValue((e.target as HTMLInputElement).value);
    };
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeyDown);
    return () => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeyDown);
    };
  });

  // Create "Add Todo" button
  const addBtn = el(['button', {}, 'Add Todo']);
  addBtn((el) => {
    const btn = el as HTMLElement;
    btn.addEventListener('click', handleAdd);
    return () => btn.removeEventListener('click', handleAdd);
  });

  // Create filter buttons
  const allBtn = el([
    'button',
    { className: api.computed(() => (todoList.filter() === 'all' ? 'active' : '')) },
    'All',
  ]);
  allBtn((el) => {
    const btn = el as HTMLElement;
    const handler = () => todoList.setFilter('all');
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  const activeBtn = el([
    'button',
    { className: api.computed(() => (todoList.filter() === 'active' ? 'active' : '')) },
    'Active',
  ]);
  activeBtn((el) => {
    const btn = el as HTMLElement;
    const handler = () => todoList.setFilter('active');
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  const completedBtn = el([
    'button',
    { className: api.computed(() => (todoList.filter() === 'completed' ? 'active' : '')) },
    'Completed',
  ]);
  completedBtn((el) => {
    const btn = el as HTMLElement;
    const handler = () => todoList.setFilter('completed');
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  // Create "Clear Completed" button
  const clearBtn = el(['button', {}, 'Clear Completed']);
  clearBtn((el) => {
    const btn = el as HTMLElement;
    const handler = () => todoList.clearCompleted();
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  return el([
    'div',
    { className: 'example' },
    el(['h2', 'Todo List Example']),
    el(['p', 'Demonstrates reactive lists with elMap, filtering, and complex state.']),

    // Input section
    el(['div', {}, todoInput, addBtn]),

    // Filter buttons
    el(['div', { className: 'filter-buttons' }, allBtn, activeBtn, completedBtn]),

    // Todo list using elMap with composed TodoItem component
    el([
      'div',
      { className: 'todo-list' },
      elMap(
        todoList.filteredTodos,
        (todoSignal: Reactive<Todo>) =>
          TodoItem(api, todoSignal, todoList.toggleTodo, todoList.removeTodo),
        (todo: Todo) => todo.id
      ),
    ]),

    // Stats
    el([
      'div',
      { className: 'todo-stats' },
      // UI-level computed concerns
      api.computed(() => `Active: ${todoList.activeCount()} | Completed: ${todoList.completedCount()} | `),
      clearBtn,
    ]),
  ]);
}
