/**
 * Devtools Example - Main Entry Point
 *
 * Demonstrates instrumented signals and view modules for devtools integration.
 * Each example uses a separate service that shows up individually in DevTools.
 */
import { useCounter } from './behaviors/useCounter';
import { useTodoList } from './behaviors/useTodoList';
import { useFilter } from './behaviors/useFilter';
import { useTodoStats } from './behaviors/useTodoStats';

import { Counter } from './views/Counter';
import { TodoList } from './views/TodoList';
import { BatchedUpdates } from './views/BatchedUpdates';

import { createService } from './service';

// Create separate services for each example
const counterService = createService('Counter');
const todoService = createService('Todo');
const batchedService = createService('Batched');

// Bind components to their services at module level
const CounterView = counterService(Counter);
const TodoListView = todoService(TodoList);
const BatchedUpdatesView = batchedService(BatchedUpdates);

const App = () => {
  // Counter example - uses its own service
  const counter = counterService(useCounter)();

  // User effect - updates document title when counter changes
  counterService.effect(() => {
    document.title = `Rimitive Demo (${counter.count()})`;
  });

  // Todo example - uses its own service
  const todoList = todoService(useTodoList)([
    { id: 1, text: 'Learn Rimitive', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]);
  const { todos, activeCount } = todoList;
  const filter = todoService(useFilter)();
  const filteredTodos = todoService.computed(() => filter.filterTodos(todos()));
  const todoStats = todoService(useTodoStats)({ todos, activeCount });

  // Batched example - uses its own service with its own state
  const batchedCounter = batchedService(useCounter)();
  const batchedTodoList = batchedService(useTodoList)([]);

  // Build the app using counterService for the root (arbitrary choice)
  const { el } = counterService;

  return el('div').props({ className: 'app' })(
    el('h1')('Rimitive DevTools Example'),
    CounterView(counter),
    TodoListView({
      todoList,
      filter,
      filteredTodos,
      stats: todoStats,
    }),
    BatchedUpdatesView({
      onBatchedUpdate: () => {
        batchedService.batch(() => {
          batchedCounter.set(10);
          batchedTodoList.addTodo('Batched todo 1');
          batchedTodoList.addTodo('Batched todo 2');
        });
      },
    })
  );
};

// Mount the app
const app = counterService.mount(App());
const container = document.querySelector('#app');

container?.appendChild(app.element as Node);
