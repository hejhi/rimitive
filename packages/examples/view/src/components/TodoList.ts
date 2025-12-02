/**
 * TodoList UI Component
 *
 * Uses @lattice/view primitives (el, map) to create a reactive UI
 * Uses the headless todo-list behavior for logic
 */

import { useTodoList, type Todo } from '../behaviors/useTodoList';
import { TodoItem } from './TodoItem';
import { el, map, signal, computed, addEventListener } from '../service';

export const TodoList = () => {
  // Create headless behavior
  const todoList = useTodoList();

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
  const todoInput = el('input').props({
    className: 'todo-input',
    type: 'text',
    placeholder: 'What needs to be done?',
    value: inputValue,
  })
    .ref(
      addEventListener('input', (e: Event) =>
        inputValue((e.target as HTMLInputElement).value)
      )
    )
    .ref(
      addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleAdd();
      })
    )();

  // Create "Add Todo" button
  const addBtn = el('button').ref(
    addEventListener('click', handleAdd)
  )('Add Todo');

  // Create filter buttons
  const allBtn = el('button').props({
    className: computed(() => (todoList.filter() === 'all' ? 'active' : '')),
  }).ref(addEventListener('click', () => todoList.setFilter('all')))('All');

  const activeBtn = el('button').props({
    className: computed(() => (todoList.filter() === 'active' ? 'active' : '')),
  }).ref(addEventListener('click', () => todoList.setFilter('active')))('Active');

  const completedBtn = el('button').props({
    className: computed(() =>
      todoList.filter() === 'completed' ? 'active' : ''
    ),
  }).ref(
    addEventListener('click', () => todoList.setFilter('completed'))
  )('Completed');

  const clearBtn = el('button').ref(
    addEventListener('click', () => todoList.clearCompleted())
  )('Clear Completed');

  return el('div').props({ className: 'example' })(
    el('h2')('Todo List Example'),
    el('p')(
      'Demonstrates reactive lists with map, filtering, and complex state.'
    ),

    // Input section
    el('div')(todoInput, addBtn),

    // Filter buttons
    el('div').props({ className: 'filter-buttons' })(allBtn, activeBtn, completedBtn),

    // Todo list using map with composed TodoItem component
    el('div').props({ className: 'todo-list' })(
      map(
        todoList.filteredTodos,
        (todo: Todo) => todo.id // Key function for immutable updates
      )((todo: Todo) =>
        TodoItem(
          todo,
          (id) => todoList.toggleTodo(id),
          (id) => todoList.removeTodo(id)
        )
      )
    ),

    // Stats
    el('div').props({ className: 'todo-stats' })(
      computed(
        () =>
          `Active: ${todoList.activeCount()} | Completed: ${todoList.completedCount()} | `
      ),
      clearBtn
    )
  );
};
