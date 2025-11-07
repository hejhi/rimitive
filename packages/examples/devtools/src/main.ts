/**
 * Lattice DevTools Example
 *
 * Demonstrates the component pattern with Lattice:
 * - Counter: Simple reactive state with derived values
 * - TodoList: Managing collections of items
 * - Filter: Composing behaviors together
 *
 * Each component is framework-agnostic and can be tested in isolation.
 */

import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import { devtoolsProvider, createInstrumentation, createApi as createLatticeApi } from '@lattice/lattice';

// View imports
import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/helpers/map';
import { On } from '@lattice/view/on';
import { createLatticeContext } from '@lattice/view/context';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createProcessChildren } from '@lattice/view/helpers/processChildren';
import { createScopes } from '@lattice/view/helpers/scope';

// Import our portable components
import { createCounter } from './components/counter';
import { createTodoList, type Todo } from './components/todo-list';
import { createFilter } from './components/filter';
import { createTodoStats } from './components/todo-stats';

function createContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const { withPropagate, dispose, startBatch, endBatch } = createScheduler({ detachAll });
  const pullPropagator = createPullPropagator({ track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: true })],
  });

  return {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    track,
    dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    startBatch,
    endBatch,
    instrumentation,
  };
}

// Create contexts
const signalCtx = createContext();
const viewCtx = createLatticeContext<HTMLElement>();
const renderer = createDOMRenderer();

// Manually create extensions with custom instrumentation
// Each extension needs its own instrument function passed to .create()
const signalsApi = {
  signal: Signal().create({ ...signalCtx, instrument: instrumentSignal }).method,
  computed: Computed().create({ ...signalCtx, instrument: instrumentComputed }).method,
  effect: Effect().create({ ...signalCtx, instrument: instrumentEffect }).method,
  batch: Batch().create({ ...signalCtx, instrument: instrumentBatch }).method,
  dispose: () => {}, // No-op for manual setup
};

const { computed, effect, signal, batch } = signalsApi;

// Create view primitives
const { disposeScope, scopedEffect, createElementScope, onCleanup } = createScopes<HTMLElement>({
  ctx: viewCtx,
  track: signalCtx.track,
  dispose: signalCtx.dispose,
  baseEffect: effect,
});

const { processChildren } = createProcessChildren<HTMLElement, Text>({
  scopedEffect,
  renderer,
});

// Create view extensions
const viewExtensions = {
  el: El(),
  map: Map(),
  on: On(),
};

// Create view API with context
const viewApi = createLatticeApi(viewExtensions, {
  ctx: viewCtx,
  scopedEffect,
  renderer,
  processChildren,
  createElementScope,
  disposeScope,
  onCleanup,
  signalCtx: signalCtx.ctx,
  signal: signal,
  startBatch: signalCtx.startBatch,
  endBatch: signalCtx.endBatch,
});

const { el, map, on } = viewApi;

// ============================================================================
// Create Components
// ============================================================================

const counter = createCounter({ signal, computed });
const todoList = createTodoList(
  { signal, computed },
  [
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]
);
const filter = createFilter({ signal, computed });

const { todos, addTodo, toggleTodo, activeCount } = todoList;
const { filterTodos, setFilter } = filter;
const { set: setCounter, count, doubled, isEven } = counter;

// ============================================================================
// Component Composition
// ============================================================================

const filteredTodos = computed(() => filterTodos(todos()));
const todoStats = createTodoStats(computed, { todos, activeCount });

// ============================================================================
// View Components
// ============================================================================

function CounterView() {
  const incrementBtn = el('button')('Increment')(
    on('click', () => setCounter(count() + 1))
  );
  const decrementBtn = el('button')('Decrement')(
    on('click', () => setCounter(count() - 1))
  );
  const resetBtn = el('button')('Reset')(
    on('click', () => setCounter(0))
  );

  return el('section', { className: 'counter-section' })(
    el('h2')('Counter Example')(),
    el('div', { className: 'counter-display' })(
      el('p')(computed(() => `Count: ${count()}`))(),
      el('p')(computed(() => `Doubled: ${doubled()}`))(),
      el('p')(computed(() => `Is Even: ${isEven() ? 'Yes' : 'No'}`))()
    )(),
    el('div', { className: 'counter-controls' })(
      incrementBtn,
      decrementBtn,
      resetBtn
    )()
  )();
}

function TodoItemView(todoSignal: () => Todo) {
  const checkbox = el('input', {
    type: 'checkbox',
    checked: computed(() => todoSignal().completed)
  })()(
    on('change', () => toggleTodo(todoSignal().id))
  );

  return el('li', {
    className: computed(() => todoSignal().completed ? 'todo-item completed' : 'todo-item')
  })(
    checkbox,
    el('span')(computed(() => todoSignal().text))()
  )();
}

function TodoListView() {
  const inputValue = signal('');

  const handleAddTodo = () => {
    const text = inputValue();
    if (text.trim()) {
      addTodo(text.trim());
      inputValue('');
    }
  };

  // Create input and attach events
  const todoInput = el('input', {
    type: 'text',
    placeholder: 'What needs to be done?',
    value: inputValue
  })()(
    on('input', (e: Event) => inputValue((e.target as HTMLInputElement).value)),
    on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleAddTodo();
    })
  );

  const addBtn = el('button')('Add Todo')(
    on('click', handleAddTodo)
  );

  // Filter buttons
  const allBtn = el('button', {
    className: computed(() => filter.currentFilter() === 'all' ? 'filter active' : 'filter')
  })('All')(
    on('click', () => setFilter('all'))
  );
  const activeBtn = el('button', {
    className: computed(() => filter.currentFilter() === 'active' ? 'filter active' : 'filter')
  })('Active')(
    on('click', () => setFilter('active'))
  );
  const completedBtn = el('button', {
    className: computed(() => filter.currentFilter() === 'completed' ? 'filter active' : 'filter')
  })('Completed')(
    on('click', () => setFilter('completed'))
  );

  return el('section', { className: 'todo-section' })(
    el('h2')('Todo List Example')(),

    // Input section
    el('div', { className: 'todo-input' })(todoInput, addBtn)(),

    // Filter buttons
    el('div', { className: 'filter-buttons' })(
      allBtn,
      activeBtn,
      completedBtn
    )(),

    // Todo list
    el('ul', { id: 'todoList' })(
      map(filteredTodos, (todo) => todo.id)((todo) => TodoItemView(todo))
    )(),

    // Stats
    el('div', { id: 'todoStats' })(
      el('strong')('Stats:')(),
      el('br')()(),
      computed(
        () =>
          `Total: ${todoStats.total()} | ` +
          `Active: ${todoStats.active()} | ` +
          `Completed: ${todoStats.completed()} | ` +
          `Completion: ${todoStats.completionRate().toFixed(1)}%`
      )
    )()
  )();
}

function BatchedUpdateSection() {
  const handleBatchedUpdates = () => {
    batch(() => {
      setCounter(10);
      addTodo('Batched todo 1');
      addTodo('Batched todo 2');
      toggleTodo(1);
    });
  };

  const batchBtn = el('button')('Run Batched Updates')(
    on('click', handleBatchedUpdates)
  );

  return el('section', { className: 'batched-section' })(
    el('h2')('Batched Updates Example')(),
    el('p')('This button demonstrates batched updates - multiple state changes in one render')(),
    batchBtn
  )();
}

// ============================================================================
// Mount App
// ============================================================================

const app = document.getElementById('app');
if (app) {
  const appView = el('div', { className: 'app' })(
    el('h1')('Lattice DevTools Example')(),
    CounterView(),
    TodoListView(),
    BatchedUpdateSection()
  )();

  const element = appView.create().element;
  if (element) {
    app.appendChild(element);
  }
}
