// Import headless behaviors
import { Counter } from './behaviors/counter';
import { TodoList } from './behaviors/todo-list';
import { Filter } from './behaviors/filter';
import { TodoStats } from './behaviors/todo-stats';

// Import view components
import { Counter as CounterView } from './views/Counter';
import { TodoList as TodoListView } from './views/TodoList';
import { BatchedUpdates as BatchedUpdatesView } from './views/BatchedUpdates';
import { create, extensions } from './api';

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

// Mount the app
const app = App().create(extensions);
const container = document.querySelector('#app');

if (container && app.element) container.appendChild(app.element);
