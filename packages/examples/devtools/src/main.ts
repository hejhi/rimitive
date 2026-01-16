/**
 * Devtools Example - Main Entry Point
 *
 * Demonstrates instrumented signals and view primitives for devtools integration.
 */
import { useCounter } from './behaviors/useCounter';
import { useTodoList } from './behaviors/useTodoList';
import { useFilter } from './behaviors/useFilter';
import { useTodoStats } from './behaviors/useTodoStats';

import { Counter } from './views/Counter';
import { TodoList } from './views/TodoList';
import { BatchedUpdates } from './views/BatchedUpdates';

import { el, computed, batch, effect, mount } from './service';

const App = () => {
  const counter = useCounter();

  // User effect - updates document title when counter changes
  effect(() => {
    document.title = `Count: ${counter.count()}`;
  });
  const todoList = useTodoList([
    { id: 1, text: 'Learn Rimitive', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]);
  const { todos, activeCount, addTodo, toggleTodo } = todoList;
  const filter = useFilter();
  const { set: setCounter } = counter;
  const filteredTodos = computed(() => filter.filterTodos(todos()));
  const todoStats = useTodoStats({ todos, activeCount });

  return el('div').props({ className: 'app' })(
    el('h1')('Rimitive DevTools Example'),
    Counter(),
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
  );
};

// Mount the app
const app = mount(App());
const container = document.querySelector('#app');

container?.appendChild(app.element as Node);
