import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalFunction } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedFunction } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
type LatticeExtension<N extends string, M> = { name: N; method: M };

function createContext() {
  const baseCtx = createBaseContext();
  const graphEdges = createGraphEdges();
  const scheduler = createScheduler();

  // Extend baseCtx in place to ensure nodeScheduler uses the same context object
  const ctx = {
    ...baseCtx,
    graphEdges,
    pushPropagator: { pushUpdates: scheduler.propagate },
    pullPropagator: null as unknown as ReturnType<typeof createPullPropagator>,
  };

  const pullPropagator = createPullPropagator(ctx, graphEdges);
  ctx.pullPropagator = pullPropagator;

  return ctx;
}

// Create signal API instance
const signalAPI = createSignalAPI(
  {
    signal: createSignalFactory as (
      ctx: unknown
    ) => LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>>,
    computed: createComputedFactory as (
      ctx: unknown
    ) => LatticeExtension<
      'computed',
      <T>(compute: () => T) => ComputedFunction<T>
    >,
    effect: createEffectFactory as (
      ctx: unknown
    ) => LatticeExtension<
      'effect',
      (fn: () => void | (() => void)) => () => void
    >,
    batch: createBatchFactory as (
      ctx: unknown
    ) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  },
  createContext()
);

const signal = signalAPI.signal as <T>(value: T) => SignalFunction<T>;
const computed = signalAPI.computed as <T>(
  compute: () => T
) => ComputedFunction<T>;
const effect = signalAPI.effect as (fn: () => void | (() => void)) => () => void;
const batch = signalAPI.batch as <T>(fn: () => T) => T;

// Counter State
const count = signal(0);

const doubled = computed(() => {
  return count() * 2;
});

const isEven = computed(() => {
  return count() % 2 === 0;
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
  return todos().filter((todo: Todo) => todo.completed).length;
});

const allCompleted = computed(() => {
  return todos().length > 0 && todos().every((todo: Todo) => todo.completed);
});

// Effects
effect(() => {
  console.log(`You have ${completedCount()} completed todos out of ${todos().length}`);
});

// Update functions
function increment() {
  count(count() + 1);
}

function decrement() {
  count(count() - 1);
}

function addTodo(text: string) {
  const newTodo: Todo = {
    id: Date.now(),
    text,
    completed: false
  };
  todos([...todos(), newTodo]);
}

function toggleTodo(id: number) {
  todos(todos().map((todo: Todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  ));
}

function toggleAll() {
  const shouldComplete = !allCompleted();
  todos(todos().map((todo: Todo) => ({ ...todo, completed: shouldComplete })));
}

// Test batching
function batchedUpdates() {
  batch(() => {
    count(10);
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

  if (countEl) countEl.textContent = count().toString();
  if (doubledEl) doubledEl.textContent = doubled().toString();
  if (isEvenEl) isEvenEl.textContent = isEven() ? 'Yes' : 'No';
  if (completedCountEl) completedCountEl.textContent = `${completedCount()} / ${todos().length}`;

  if (todoListEl) {
    todoListEl.innerHTML = todos()
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
