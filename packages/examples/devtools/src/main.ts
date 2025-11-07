/**
 * Lattice DevTools Example
 *
 * Demonstrates the component pattern with Lattice:
 * - Counter: Simple reactive state with derived values
 * - TodoList: Managing collections of items
 * - Filter: Composing behaviors together
 *
 * Each component is framework-agnostic and can be tested in isolation.
 */

import { create } from '@lattice/view/component';

// Import API modules
import { signal, computed, batch } from './api/signals';
import { mount } from './api/view';

// Import headless components
import { createCounter } from './components/counter';
import { createTodoList } from './components/todo-list';
import { createFilter } from './components/filter';
import { createTodoStats } from './components/todo-stats';

// Import view components
import { Counter } from './views/Counter';
import { TodoList } from './views/TodoList';
import { BatchedUpdates } from './views/BatchedUpdates';

// ============================================================================
// Create Headless Components
// ============================================================================

const counter = createCounter({ signal, computed });
const todoList = createTodoList(
  { signal, computed },
  [
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]
);
const filter = createFilter({ signal, computed });

const { set: setCounter } = counter;
const { addTodo, toggleTodo } = todoList;

// ============================================================================
// Component Composition
// ============================================================================

const filteredTodos = computed(() => filter.filterTodos(todoList.todos()));
const todoStats = createTodoStats(computed, { todos: todoList.todos, activeCount: todoList.activeCount });

// ============================================================================
// Main App Component using create() pattern
// ============================================================================

const App = create((api) => () => {
  const { el } = api;

  return el('div', { className: 'app' })(
    el('h1')('Lattice DevTools Example')(),
    Counter(counter),
    TodoList(todoList, filter, filteredTodos, todoStats),
    BatchedUpdates({
      onBatchedUpdate: () => {
        batch(() => {
          setCounter(10);
          addTodo('Batched todo 1');
          addTodo('Batched todo 2');
          toggleTodo(1);
        });
      },
    })
  )();
});

// ============================================================================
// Mount App
// ============================================================================

mount('#app', App());
