import { createStore, createContext } from '@lattice/lattice';
import { signalExtension, computedExtension, effectExtension, batchExtension, selectExtension } from '@lattice/lattice';
import { createInstrumentation, enableDevTools } from '@lattice/devtools';
import { select } from '@lattice/signals/select';

// Enable global DevTools API for browser extension
enableDevTools();

// Create instrumentation for debugging
const instrumentation = createInstrumentation({
  name: 'Lattice DevTools Demo',
  trackReads: true,
  trackComputations: true,
});

// Create a context with instrumentation
const counterContext = createContext(
  { instrumentation },
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension
);

// Counter Store
const counterStore = createStore(
  {
    count: 0,
  },
  counterContext
);

const doubled = counterContext.computed(() => {
  return counterStore.state.count.value * 2;
}, 'doubled');

const isEven = counterContext.computed(() => {
  return counterStore.state.count.value % 2 === 0;
}, 'isEven');

// Todo Store
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

// Create a separate context for todos to demonstrate multiple contexts
const todoContext = createContext(
  { instrumentation },
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension
);

const todoStore = createStore(
  {
    todos: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',
  },
  todoContext
);

// Use selectors to create more granular reactivity
const currentFilter = select(todoStore.state.filter, (f) => f);
const activeTodos = select(todoStore.state.todos, (todos) =>
  todos.filter((todo) => !todo.completed)
);
const completedTodos = select(todoStore.state.todos, (todos) =>
  todos.filter((todo) => todo.completed)
);

const filteredTodos = todoContext.computed(() => {
  const filter = currentFilter.value;
  const todos = todoStore.state.todos.value;

  switch (filter) {
    case 'active':
      return activeTodos.value;
    case 'completed':
      return completedTodos.value;
    default:
      return todos;
  }
});

const activeTodoCount = todoContext.computed(() => {
  return activeTodos.value.length;
});

// UI Updates
counterContext.effect(() => {
  document.getElementById('count')!.textContent = String(
    counterStore.state.count.value
  );
});

counterContext.effect(() => {
  document.getElementById('doubled')!.textContent = String(doubled.value);
});

counterContext.effect(() => {
  document.getElementById('isEven')!.textContent = String(isEven.value);
});

todoContext.effect(() => {
  const todoList = document.getElementById('todoList')!;
  const todos = filteredTodos.value;

  if (todos.length === 0) {
    todoList.innerHTML = '<li style="color: #999;">No todos yet...</li>';
  } else {
    todoList.innerHTML = todos
      .map(
        (todo) => `
          <li class="todo-item ${todo.completed ? 'completed' : ''}">
            <input 
              type="checkbox" 
              ${todo.completed ? 'checked' : ''} 
              data-todo-id="${todo.id}"
            />
            <span>${todo.text}</span>
          </li>
        `
      )
      .join('');
  }
});

todoContext.effect(() => {
  document.getElementById('activeTodoCount')!.textContent = String(
    activeTodoCount.value
  );
});

// Event Handlers
document.getElementById('increment')!.addEventListener('click', () => {
  counterStore.set({ count: counterStore.state.count.value + 1 });
});

document.getElementById('decrement')!.addEventListener('click', () => {
  counterStore.set({ count: counterStore.state.count.value - 1 });
});

document.getElementById('reset')!.addEventListener('click', () => {
  counterStore.set({ count: 0 });
});

document.getElementById('addTodo')!.addEventListener('click', () => {
  const input = document.getElementById('todoInput') as HTMLInputElement;
  if (input.value.trim()) {
    const newTodo: Todo = {
      id: Date.now(),
      text: input.value.trim(),
      completed: false,
    };

    todoStore.set({
      todos: [...todoStore.state.todos.value, newTodo],
    });

    input.value = '';
  }
});

document.getElementById('todoInput')!.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addTodo')!.click();
  }
});

// Filter buttons
document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', (e) => {
    const target = e.target as HTMLButtonElement;
    const filter = target.getAttribute('data-filter') as
      | 'all'
      | 'active'
      | 'completed';

    todoStore.set({ filter });

    // Update active button
    document
      .querySelectorAll('.filter')
      .forEach((btn) => btn.classList.remove('active'));
    target.classList.add('active');
  });
});

// Todo checkbox handling
document.getElementById('todoList')!.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.type === 'checkbox') {
    const todoId = Number(target.getAttribute('data-todo-id'));
    const todos = todoStore.state.todos.value;
    const updatedTodos = todos.map((todo) =>
      todo.id === todoId ? { ...todo, completed: target.checked } : todo
    );

    todoStore.set({ todos: updatedTodos });
  }
});
