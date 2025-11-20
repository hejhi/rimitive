/**
 * TodoList View Component
 *
 * Main todo list interface with input, filters, and stats.
 * Uses the create() pattern.
 */

import { use } from '../api';
import type { Todo } from '../behaviors/useTodoList';
import { TodoItem } from './TodoItem';

interface TodoListInstance {
  todos: () => Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  activeCount: () => number;
}

interface FilterInstance {
  currentFilter: () => 'all' | 'active' | 'completed';
  setFilter: (filter: 'all' | 'active' | 'completed') => void;
}

interface TodoStatsInstance {
  total: () => number;
  active: () => number;
  completed: () => number;
  completionRate: () => number;
}

export const TodoList = use(
  ({ el, map, addEventListener, signal, computed }) =>
    (
      { addTodo, toggleTodo }: TodoListInstance,
      { currentFilter, setFilter }: FilterInstance,
      filteredTodos: () => Todo[],
      { total, active, completed, completionRate }: TodoStatsInstance
    ) => {
      const inputValue = signal('');

      const handleAddTodo = () => {
        const text = inputValue();
        if (text.trim()) {
          addTodo(text.trim());
          inputValue('');
        }
      };

      // Create input and attach events
      const todoInput = el('input', {
        type: 'text',
        placeholder: 'What needs to be done?',
        value: inputValue,
      })()(
        addEventListener('input', (e) =>
          inputValue((e.target as HTMLInputElement).value)
        ),
        addEventListener('keydown', (e) => {
          if (e.key === 'Enter') handleAddTodo();
        })
      );

      const addBtn = el('button')('Add Todo')(
        addEventListener('click', handleAddTodo)
      );

      // Filter buttons
      const allBtn = el('button', {
        className: computed(() =>
          currentFilter() === 'all' ? 'filter active' : 'filter'
        ),
      })('All')(addEventListener('click', () => setFilter('all')));
      const activeBtn = el('button', {
        className: computed(() =>
          currentFilter() === 'active' ? 'filter active' : 'filter'
        ),
      })('Active')(addEventListener('click', () => setFilter('active')));
      const completedBtn = el('button', {
        className: computed(() =>
          currentFilter() === 'completed' ? 'filter active' : 'filter'
        ),
      })('Completed')(addEventListener('click', () => setFilter('completed')));

      return el('section', { className: 'todo-section' })(
        el('h2')('Todo List Example'),

        // Input section
        el('div', { className: 'todo-input' })(todoInput, addBtn),

        // Filter buttons
        el('div', { className: 'filter-buttons' })(
          allBtn,
          activeBtn,
          completedBtn
        ),

        // Todo list
        el('ul', { id: 'todoList' })(
          map(
            filteredTodos,
            (todo) => todo.id
          )((todo) => TodoItem(todo, toggleTodo))
        ),

        // Stats
        el('div', { id: 'todoStats' })(
          el('strong')('Stats:'),
          el('br')(),
          computed(
            () =>
              `Total: ${total()} | ` +
              `Active: ${active()} | ` +
              `Completed: ${completed()} | ` +
              `Completion: ${completionRate().toFixed(1)}%`
          )
        )
      );
    }
);
