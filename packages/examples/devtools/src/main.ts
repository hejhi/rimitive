import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';

// Create signal API instance
const signalAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
}, createDefaultContext());

const { signal, computed, effect, batch } = signalAPI;

// Counter State
const count = signal(0);

const doubled = computed(() => {
  return count.value * 2;
});

const isEven = computed(() => {
  return count.value % 2 === 0;
});

// Todo State
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const todos = signal<Todo[]>([
  { id: 1, text: 'Learn Lattice', completed: false },
  { id: 2, text: 'Build an app', completed: false }
]);

const completedCount = computed(() => {
  return todos.value.filter(todo => todo.completed).length;
});

const allCompleted = computed(() => {
  return todos.value.length > 0 && todos.value.every(todo => todo.completed);
});

// Effects
effect(() => {
  console.log(`You have ${completedCount.value} completed todos out of ${todos.value.length}`);
});

// Update functions
function increment() {
  count.value++;
}

function decrement() {
  count.value--;
}

function addTodo(text: string) {
  const newTodo: Todo = {
    id: Date.now(),
    text,
    completed: false
  };
  todos.value = [...todos.value, newTodo];
}

function toggleTodo(id: number) {
  todos.value = todos.value.map((todo: Todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  );
}

function toggleAll() {
  const shouldComplete = !allCompleted.value;
  todos.value = todos.value.map((todo: Todo) => ({ ...todo, completed: shouldComplete }));
}

// Test batching
function batchedUpdates() {
  batch(() => {
    count.value = 10;
    addTodo('Batched todo 1');
    addTodo('Batched todo 2');
    toggleTodo(1);
  });
}

// Update UI
function updateUI() {
  const countEl = document.getElementById('count');
  const doubledEl = document.getElementById('doubled');
  const isEvenEl = document.getElementById('isEven');
  const todoListEl = document.getElementById('todo-list');
  const completedCountEl = document.getElementById('completed-count');

  if (countEl) countEl.textContent = count.value.toString();
  if (doubledEl) doubledEl.textContent = doubled.value.toString();
  if (isEvenEl) isEvenEl.textContent = isEven.value ? 'Yes' : 'No';
  if (completedCountEl) completedCountEl.textContent = `${completedCount.value} / ${todos.value.length}`;

  if (todoListEl) {
    todoListEl.innerHTML = todos.value
      .map((todo: Todo) => `
        <li class="${todo.completed ? 'completed' : ''}">
          <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                 onchange="window.toggleTodo(${todo.id})">
          ${todo.text}
        </li>
      `)
      .join('');
  }
}

// Set up reactive updates
effect(() => {
  updateUI();
});

// Export functions to window for onclick handlers
Object.assign(window, {
  increment,
  decrement,
  addTodo: () => {
    const input = document.getElementById('new-todo') as HTMLInputElement;
    if (input && input.value.trim()) {
      addTodo(input.value.trim());
      input.value = '';
    }
  },
  toggleTodo,
  toggleAll,
  batchedUpdates
});

// Initial UI update
updateUI();