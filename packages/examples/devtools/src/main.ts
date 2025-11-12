// Import headless behaviors
import { createCounter } from './behaviors/counter';
import { createTodoList } from './behaviors/todo-list';
import { createFilter } from './behaviors/filter';
import { createTodoStats } from './behaviors/todo-stats';

// Import view components
import { Counter as CounterView } from './views/Counter';
import { TodoList as TodoListView } from './views/TodoList';
import { BatchedUpdates as BatchedUpdatesView } from './views/BatchedUpdates';
import { create, mount } from './api';

const App = create(({ el, signal, computed, batch }) => () => {
  const counter = createCounter({ signal, computed }, 0);
  const todoList = createTodoList({ signal, computed }, [
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]);
  const { todos, activeCount, addTodo, toggleTodo } = todoList;
  const filter = createFilter({ signal });
  const { set: setCounter } = counter;
  const filteredTodos = computed(() => filter.filterTodos(todos()));
  const todoStats = createTodoStats(
    { computed },
    { todos, activeCount }
  );

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

// Mount the app
const app = mount(App());
const container = document.querySelector('#app');

container?.appendChild(app.element!);
