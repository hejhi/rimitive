import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalFunction } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedFunction } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { devtoolsProvider, createInstrumentation } from '@lattice/lattice';

function createContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const pullPropagator = createPullPropagator({ track: graphEdges.track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: true })],
  });

  return {
    ctx,
    trackDependency: graphEdges.trackDependency,
    propagate: scheduler.propagate,
    track: graphEdges.track,
    dispose: scheduler.dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    startBatch: scheduler.startBatch,
    endBatch: scheduler.endBatch,
    instrumentation,
  };
}

type LatticeExtension<N extends string, M> = { name: N; method: M };

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

const doubled = computed(() => count() * 2);

const isEven = computed(() => count() % 2 === 0);

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

// Filter State
type FilterType = 'all' | 'active' | 'completed';
const currentFilter = signal<FilterType>('all');

const filteredTodos = computed(() => {
  const filter = currentFilter();
  const todosList = todos();

  if (filter === 'active') return todosList.filter(t => !t.completed);
  if (filter === 'completed') return todosList.filter(t => t.completed);
  return todosList;
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

function batchedUpdates() {
  batch(() => {
    count(10);
    addTodo('Batched todo 1');
    addTodo('Batched todo 2');
    toggleTodo(1);
  });
}

// UI Update Logic
function updateUI() {
  const countEl = document.getElementById('count');
  const doubledEl = document.getElementById('doubled');
  const isEvenEl = document.getElementById('isEven');
  const todoListEl = document.getElementById('todoList');
  const activeTodoCountEl = document.getElementById('activeTodoCount');

  if (countEl) countEl.textContent = count().toString();
  if (doubledEl) doubledEl.textContent = doubled().toString();
  if (isEvenEl) isEvenEl.textContent = isEven() ? 'Yes' : 'No';

  const activeTodoCount = todos().filter(t => !t.completed).length;
  if (activeTodoCountEl) activeTodoCountEl.textContent = activeTodoCount.toString();

  if (todoListEl) {
    todoListEl.innerHTML = filteredTodos()
      .map((todo: Todo) => `
        <li class="todo-item ${todo.completed ? 'completed' : ''}">
          <input type="checkbox" ${todo.completed ? 'checked' : ''}
                 onchange="window.toggleTodo(${todo.id})">
          <span>${todo.text}</span>
        </li>
      `)
      .join('');
  }
}

function setFilter(filter: FilterType) {
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
  currentFilter(filter);
}

function addTodoFromInput() {
  const input = document.getElementById('todoInput') as HTMLInputElement;
  if (input && input.value.trim()) {
    addTodo(input.value.trim());
    input.value = '';
  }
}

// Set up reactive UI updates
effect(updateUI);

// Export for inline handlers
Object.assign(window, {
  increment,
  decrement,
  count,
  toggleTodo,
  toggleAll,
  setFilter,
  addTodoFromInput,
  batchedUpdates,
});
