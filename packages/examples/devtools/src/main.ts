// Import headless behaviors
import { useCounter } from './behaviors/useCounter';
import { useTodoList } from './behaviors/useTodoList';
import { useFilter } from './behaviors/useFilter';
import { useTodoStats } from './behaviors/useTodoStats';

// Import view components
import { Counter as CounterView } from './views/Counter';
import { TodoList as TodoListView } from './views/TodoList';
import { BatchedUpdates as BatchedUpdatesView } from './views/BatchedUpdates';
import { create, mount } from './api';

const App = create(({ el, signal, computed, batch }) => () => {
  const counter = useCounter({ signal, computed }, 0);
  const todoList = useTodoList({ signal, computed }, [
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]);
  const { todos, activeCount, addTodo, toggleTodo } = todoList;
  const filter = useFilter({ signal });
  const { set: setCounter } = counter;
  const filteredTodos = computed(() => filter.filterTodos(todos()));
  const todoStats = useTodoStats({ computed }, { todos, activeCount });

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

container?.appendChild(app.element as Node);
