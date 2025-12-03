/**
 * TodoList View Component
 *
 * Main todo list interface with input, filters, and stats.
 */
import { el, map, on, signal, computed } from '../service';
import type { Todo, UseTodoList } from '../behaviors/useTodoList';
import type { FilterType } from '../behaviors/useFilter';
import { TodoItem } from './TodoItem';

interface FilterInstance {
  currentFilter: () => FilterType;
  setFilter: (filter: FilterType) => void;
}

interface TodoStatsInstance {
  total: () => number;
  active: () => number;
  completed: () => number;
  completionRate: () => number;
}

export const TodoList = (
  { addTodo, toggleTodo }: Pick<UseTodoList, 'addTodo' | 'toggleTodo'>,
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
  const todoInput = el('input')
    .props({
      type: 'text',
      placeholder: 'What needs to be done?',
      value: inputValue,
    })
    .ref(on('input', (e) => inputValue((e.target as HTMLInputElement).value)))
    .ref(
      on('keydown', (e) => {
        if (e.key === 'Enter') handleAddTodo();
      })
    )();

  const addBtn = el('button').props({ onclick: handleAddTodo })('Add Todo');

  // Filter buttons
  const allBtn = el('button').props({
    className: computed(() =>
      currentFilter() === 'all' ? 'filter active' : 'filter'
    ),
    onclick: () => setFilter('all'),
  })('All');

  const activeBtn = el('button').props({
    className: computed(() =>
      currentFilter() === 'active' ? 'filter active' : 'filter'
    ),
    onclick: () => setFilter('active'),
  })('Active');

  const completedBtn = el('button').props({
    className: computed(() =>
      currentFilter() === 'completed' ? 'filter active' : 'filter'
    ),
    onclick: () => setFilter('completed'),
  })('Completed');

  return el('section').props({ className: 'todo-section' })(
    el('h2')('Todo List Example'),

    // Input section
    el('div').props({ className: 'todo-input' })(todoInput, addBtn),

    // Filter buttons
    el('div').props({ className: 'filter-buttons' })(
      allBtn,
      activeBtn,
      completedBtn
    ),

    // Todo list
    el('ul').props({ id: 'todoList' })(
      map(
        filteredTodos,
        (todo) => todo.id,
        (todoSignal) => TodoItem(todoSignal(), toggleTodo)
      )
    ),

    // Stats
    el('div').props({ id: 'todoStats' })(
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
};
