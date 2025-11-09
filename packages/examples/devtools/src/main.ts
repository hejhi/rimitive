/**
 * Lattice DevTools Example
 *
 * Demonstrates the behavior pattern with Lattice:
 * - Counter: Simple reactive state with derived values
 * - TodoList: Managing collections of items
 * - Filter: Composing behaviors together
 *
 * Each behavior is framework-agnostic and can be tested in isolation.
 */

import { create } from '@lattice/view/component';

// Import API modules
import { mount } from './api/view';

// Import headless behaviors
import { Counter } from './behaviors/counter';
import { TodoList } from './behaviors/todo-list';
import { Filter } from './behaviors/filter';
import { TodoStats } from './behaviors/todo-stats';

// Import view components
import { Counter as CounterView } from './views/Counter';
import { TodoList as TodoListView } from './views/TodoList';
import { BatchedUpdates as BatchedUpdatesView } from './views/BatchedUpdates';

// ============================================================================
// Main App Component using create() pattern
// ============================================================================

const App = create((api) => () => {
  const { el, computed, batch } = api;
  const counter = Counter(0).create(api);
  const todoList = TodoList([
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]).create(api);
  const filter = Filter().create(api);
  const { set: setCounter } = counter;
  const { addTodo, toggleTodo } = todoList;
  const filteredTodos = computed(() => filter.filterTodos(todoList.todos()));
  const todoStats = TodoStats({
    todos: todoList.todos,
    activeCount: todoList.activeCount,
  }).create(api);

  return el('div', { className: 'app' })(
    el('h1')('Lattice DevTools Example'),
    CounterView(counter),
    TodoListView(todoList, filter, filteredTodos, todoStats),
    BatchedUpdatesView({
      onBatchedUpdate: () => {
        batch(() => {
          setCounter(10);
          addTodo('Batched todo 1');
          addTodo('Batched todo 2');
          toggleTodo(1);
        });
      },
    })
  );
});

// ============================================================================
// Mount App
// ============================================================================

mount('#app', App());
