import { withInstrumentation, signalExtension, computedExtension, effectExtension, batchExtension, selectExtension, performanceProvider, devtoolsProvider } from '@lattice/store';
import { select } from '@lattice/signals/select';

// Create counter context with multiple instrumentation providers
const counterContext = withInstrumentation(
  {
    providers: [
      devtoolsProvider({ debug: true }),
      performanceProvider({ threshold: 5, logAll: false })
    ],
    enabled: true // Could be import.meta.env.DEV for conditional enabling
  },
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension
);

// Counter State
const count = counterContext.signal(0, 'count');

const doubled = counterContext.computed(() => {
  return count.value * 2;
}, 'doubled');

const isEven = counterContext.computed(() => {
  return count.value % 2 === 0;
}, 'isEven');

// Todo State
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

// Create todo context with devtools instrumentation enabled
const todoContext = withInstrumentation(
  {
    providers: [
      devtoolsProvider({ debug: false }), // Less verbose for this context
      performanceProvider({ threshold: 10 })
    ]
  },
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension
);

const todos = todoContext.signal<Todo[]>([], 'todos');
const filter = todoContext.signal<'all' | 'active' | 'completed'>('all', 'filter');

// Use selectors to create more granular reactivity
const currentFilter = select(filter, (f) => f);
const activeTodos = select(todos, (todos) =>
  todos.filter((todo) => !todo.completed)
);
const completedTodos = select(todos, (todos) =>
  todos.filter((todo) => todo.completed)
);

const filteredTodos = todoContext.computed(() => {
  const filterValue = currentFilter.value;
  const allTodos = todos.value;

  switch (filterValue) {
    case 'active':
      return activeTodos.value;
    case 'completed':
      return completedTodos.value;
    default:
      return allTodos;
  }
});

const activeTodoCount = todoContext.computed(() => {
  return activeTodos.value.length;
});

// UI Updates
counterContext.effect(() => {
  document.getElementById('count')!.textContent = String(count.value);
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
  count.value = count.value + 1;
});

document.getElementById('decrement')!.addEventListener('click', () => {
  count.value = count.value - 1;
});

document.getElementById('reset')!.addEventListener('click', () => {
  count.value = 0;
});

document.getElementById('addTodo')!.addEventListener('click', () => {
  const input = document.getElementById('todoInput') as HTMLInputElement;
  if (input.value.trim()) {
    const newTodo: Todo = {
      id: Date.now(),
      text: input.value.trim(),
      completed: false,
    };

    todos.value = [...todos.value, newTodo];

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
    const filterValue = target.getAttribute('data-filter') as
      | 'all'
      | 'active'
      | 'completed';

    filter.value = filterValue;

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
    const currentTodos = todos.value;
    const updatedTodos = currentTodos.map((todo) =>
      todo.id === todoId ? { ...todo, completed: target.checked } : todo
    );

    todos.value = updatedTodos;
  }
});
