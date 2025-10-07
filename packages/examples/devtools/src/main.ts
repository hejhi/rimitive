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

import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { instrumentSignal, instrumentComputed, instrumentEffect, instrumentBatch } from '@lattice/signals/instrumentation';
import { devtoolsProvider, createInstrumentation, createApi } from '@lattice/lattice';

// Import our portable components
import { createCounter } from './components/counter';
import { createTodoList, type Todo } from './components/todo-list';
import { createFilter, type FilterType } from './components/filter';
import { createTodoStats } from './components/todo-stats';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

function createContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { traverseGraph } = createGraphTraversal();
  const scheduler = createScheduler({
    traverseGraph,
    detachAll,
  });
  const pullPropagator = createPullPropagator({ track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: true })],
  });

  return {
    ctx,
    trackDependency,
    propagate: scheduler.propagate,
    track,
    dispose: scheduler.dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    startBatch: scheduler.startBatch,
    endBatch: scheduler.endBatch,
    instrumentation,
  };
}

// Create signal API instance
const signalAPI = createApi(
  {
    signal: (ctx: any) => createSignalFactory({ ...ctx, instrument: instrumentSignal }),
    computed: (ctx: any) => createComputedFactory({ ...ctx, instrument: instrumentComputed }),
    effect: (ctx: any) => createEffectFactory({ ...ctx, instrument: instrumentEffect }),
    batch: (ctx: any) => createBatchFactory({ ...ctx, instrument: instrumentBatch }),
  },
  createContext()
);

// Extract primitives for convenience
const effect = signalAPI.effect as (fn: () => void | (() => void)) => () => void;
const batch = signalAPI.batch as <T>(fn: () => T) => T;

// ============================================================================
// Create Components
// ============================================================================
// These components are framework-agnostic and can be tested independently

const counter = createCounter(signalAPI);

const todoList = createTodoList(signalAPI, [
  { id: 1, text: 'Learn Lattice', completed: false },
  { id: 2, text: 'Build an app', completed: false },
]);

const filter = createFilter(signalAPI);

// ============================================================================
// Component Composition
// ============================================================================
// Demonstrates two composition patterns:

// 1. Functional composition - combine outputs
const filteredTodos = signalAPI.computed(() =>
  filter.filterTodos(todoList.todos())
);

// 2. Dependency injection - stats depends on todoList
const todoStats = createTodoStats(signalAPI, todoList);

// ============================================================================
// UI Adapter Functions
// ============================================================================
// These functions adapt component APIs to the DOM event handlers

function batchedUpdates() {
  batch(() => {
    counter.set(10);
    todoList.addTodo('Batched todo 1');
    todoList.addTodo('Batched todo 2');
    todoList.toggleTodo(1);
  });
}

function addTodoFromInput() {
  const input = document.getElementById('todoInput') as HTMLInputElement;
  if (input && input.value.trim()) {
    todoList.addTodo(input.value.trim());
    input.value = '';
  }
}

function setFilter(filterType: FilterType) {
  document.querySelectorAll('.filter').forEach((b) => b.classList.remove('active'));
  document.querySelector(`[data-filter="${filterType}"]`)?.classList.add('active');
  filter.setFilter(filterType);
}

// ============================================================================
// UI Rendering
// ============================================================================
// This effect runs whenever any reactive dependency changes

function updateUI() {
  // Update counter display
  const countEl = document.getElementById('count');
  const doubledEl = document.getElementById('doubled');
  const isEvenEl = document.getElementById('isEven');

  if (countEl) countEl.textContent = counter.count().toString();
  if (doubledEl) doubledEl.textContent = counter.doubled().toString();
  if (isEvenEl) isEvenEl.textContent = counter.isEven() ? 'Yes' : 'No';

  // Update todo list display
  const activeTodoCountEl = document.getElementById('activeTodoCount');
  if (activeTodoCountEl) {
    activeTodoCountEl.textContent = todoList.activeCount().toString();
  }

  const todoListEl = document.getElementById('todoList');
  if (todoListEl) {
    todoListEl.innerHTML = filteredTodos()
      .map(
        (todo: Todo) => `
        <li class="todo-item ${todo.completed ? 'completed' : ''}">
          <input type="checkbox" ${todo.completed ? 'checked' : ''}
                 onchange="window.todoList.toggleTodo(${todo.id})">
          <span>${todo.text}</span>
        </li>
      `
      )
      .join('');
  }

  // Update stats display (demonstrates composed component)
  const statsEl = document.getElementById('todoStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <strong>Stats (from composed component):</strong><br>
      Total: ${todoStats.total()} |
      Active: ${todoStats.active()} |
      Completed: ${todoStats.completed()} |
      Completion: ${todoStats.completionRate().toFixed(1)}%
    `;
  }
}

// Set up reactive UI updates
effect(updateUI);

// ============================================================================
// Export to Window for DOM Event Handlers
// ============================================================================
// In a real app, you'd use a framework's event binding instead

Object.assign(window, {
  // Expose components directly - demonstrates clear API boundaries
  counter,
  todoList,
  filter,

  // Expose adapter functions
  setFilter,
  addTodoFromInput,
  batchedUpdates,
});
