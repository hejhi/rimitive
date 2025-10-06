/**
 * Lattice React Component Pattern Example
 *
 * This example demonstrates:
 * 1. Using the component pattern in React with useComponent
 * 2. Reusing the same components from the devtools example
 * 3. DevTools integration to debug reactive state
 * 4. Multiple use cases for the same component (counter -> steps, slides, etc.)
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { SignalProvider, useComponent, useSubscribe } from '@lattice/react';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { instrumentSignal, instrumentComputed, instrumentEffect } from '@lattice/signals/instrumentation';
import { devtoolsProvider, createInstrumentation } from '@lattice/lattice';

// Import our React-compatible components
import { createCounter } from './components/counter';
import { createTodoList } from './components/todo-list';
import { createFilter } from './components/filter';
import { Modal } from './design-system/Modal';

// ============================================================================
// Create Instrumented Signal API with DevTools
// ============================================================================

function createContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const pullPropagator = createPullPropagator({ track: graphEdges.track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: false })],
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

// Create signal API instance with instrumentation
const signalAPI = createSignalAPI(
  {
    signal: (ctx: any) => createSignalFactory({ ...ctx, instrument: instrumentSignal }),
    computed: (ctx: any) => createComputedFactory({ ...ctx, instrument: instrumentComputed }),
    effect: (ctx: any) => createEffectFactory({ ...ctx, instrument: instrumentEffect }),
    batch: createBatchFactory as (
      ctx: unknown
    ) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  },
  createContext()
);

/**
 * Example 1: Step Counter
 * Using the counter component to track steps in a multi-step process
 */
function StepCounter() {
  const counter = useComponent(createCounter);
  const step = useSubscribe(counter.count);
  const isEven = useSubscribe(counter.isEven);

  return (
    <div className="example-section">
      <h2>Step Counter</h2>
      <p>Using <code>createCounter</code> to build a step-by-step wizard</p>

      <div className="counter-display">Step {step} / 5</div>

      <div>
        <button onClick={counter.decrement} disabled={step === 0}>
          ← Previous Step
        </button>
        <button onClick={counter.increment} disabled={step === 5}>
          Next Step →
        </button>
        <button onClick={() => counter.set(0)}>Reset</button>
      </div>

      <p>
        Current step is: <span className="computed-value">{isEven ? 'Even' : 'Odd'}</span>
      </p>
    </div>
  );
}

/**
 * Example 2: Slide Carousel
 * Same counter component, completely different UI and use case
 */
function SlideCarousel() {
  const slides = [
    'Introduction to Lattice',
    'Creating Components',
    'Using in React',
    'Using in Vue',
    'Building a Design System',
  ];

  const counter = useComponent(createCounter);
  const current = useSubscribe(counter.count);
  const doubled = useSubscribe(counter.doubled);

  return (
    <div className="example-section">
      <h2>Slide Carousel</h2>
      <p>Same <code>createCounter</code> component, different use case</p>

      <div
        style={{
          background: '#007bff',
          color: 'white',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3>{slides[current] || 'End of slides'}</h3>
      </div>

      <div>
        <button onClick={counter.decrement} disabled={current === 0}>
          ←
        </button>
        <span style={{ margin: '0 1rem' }}>
          Slide {current + 1} / {slides.length}
        </span>
        <button onClick={counter.increment} disabled={current >= slides.length - 1}>
          →
        </button>
      </div>

      <p>
        Slide index doubled: <span className="computed-value">{doubled}</span>
      </p>
    </div>
  );
}

/**
 * Example 3: Todo Application
 * Using todoList + filter components together - composition!
 */
function TodoApp() {
  const todoList = useComponent(createTodoList, [
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build a React app', completed: false },
    { id: 3, text: 'Try the component pattern', completed: true },
  ]);

  const filter = useComponent(createFilter);

  // Subscribe to reactive values
  const allTodos = useSubscribe(todoList.todos);
  const activeCount = useSubscribe(todoList.activeCount);
  const allCompleted = useSubscribe(todoList.allCompleted);
  const currentFilter = useSubscribe(filter.currentFilter);

  // Compose: filter the todos
  const filteredTodos = filter.filterTodos(allTodos);

  const handleAddTodo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      todoList.addTodo(e.currentTarget.value.trim());
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="example-section">
      <h2>Todo Application</h2>
      <p>
        Composing <code>createTodoList</code> + <code>createFilter</code> components
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Add a new todo..."
          onKeyDown={handleAddTodo}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => filter.setFilter('all')}
          style={{ background: currentFilter === 'all' ? '#007bff' : '#6c757d' }}
        >
          All
        </button>
        <button
          onClick={() => filter.setFilter('active')}
          style={{ background: currentFilter === 'active' ? '#007bff' : '#6c757d' }}
        >
          Active
        </button>
        <button
          onClick={() => filter.setFilter('completed')}
          style={{ background: currentFilter === 'completed' ? '#007bff' : '#6c757d' }}
        >
          Completed
        </button>
      </div>

      <div>
        {filteredTodos.map((todo) => (
          <div
            key={todo.id}
            className={`todo-item ${todo.completed ? 'completed' : ''}`}
            onClick={() => todoList.toggleTodo(todo.id)}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => {}}
              style={{ pointerEvents: 'none' }}
            />
            <span>{todo.text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <p>
          Active todos: <span className="computed-value">{activeCount}</span>
        </p>
        <button onClick={todoList.toggleAll}>
          {allCompleted ? 'Mark all active' : 'Mark all complete'}
        </button>
      </div>
    </div>
  );
}

/**
 * Example 4: Design System Pattern - Encapsulated State
 * Each Modal has its own SignalProvider, completely isolated
 */
function DesignSystemDemo() {
  return (
    <div className="example-section">
      <h2>Design System Pattern - Encapsulated State</h2>
      <p>
        Each <code>Modal</code> component has its own <code>SignalProvider</code>,
        similar to how Chakra UI components manage internal state.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Modal title="User Settings">
          <p>This modal has its own isolated signal context.</p>
          <p>Opening/closing this modal doesn't affect other modals.</p>
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <input type="checkbox" /> Enable notifications
            </label>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <input type="checkbox" /> Dark mode
            </label>
          </div>
        </Modal>

        <Modal title="Confirmation">
          <p>This is a completely separate modal instance.</p>
          <p>It has its own signal context, totally isolated from the first modal.</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button style={{ flex: 1 }}>Cancel</button>
            <button style={{ flex: 1, background: '#dc3545' }}>Delete</button>
          </div>
        </Modal>

        <Modal title="Help & Documentation">
          <h3 style={{ marginTop: 0 }}>How to use Lattice</h3>
          <p>This modal demonstrates how design system components can:</p>
          <ul>
            <li>Have their own encapsulated state</li>
            <li>Work independently from other instances</li>
            <li>Still integrate with DevTools for debugging</li>
          </ul>
        </Modal>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#e7f3ff', borderRadius: '4px' }}>
        <strong>Key Pattern:</strong> Each <code>{'<Modal>'}</code> creates its own{' '}
        <code>{'<SignalProvider>'}</code> internally, giving it isolated reactive state.
        This is perfect for reusable design system components that need to manage their
        own state without polluting the global context.
      </div>
    </div>
  );
}

/**
 * Root App Component
 */
function App() {
  return (
    <div className="container">
      <h1>Lattice React Component Pattern</h1>

      <div className="info">
        <strong>Open Chrome DevTools → "Lattice" tab</strong> to see reactive state
        updates in real-time!
        <br />
        <br />
        This example demonstrates multiple component patterns:
        <ul>
          <li>
            <strong>Shared Context:</strong> <code>createCounter</code> and <code>createTodoList</code>
            use the global SignalProvider
          </li>
          <li>
            <strong>Encapsulated State:</strong> <code>Modal</code> components have their own
            isolated SignalProviders
          </li>
          <li>
            <strong>Framework Agnostic:</strong> All behaviors work in React, Vue, Svelte, or vanilla JS
          </li>
        </ul>
      </div>

      <StepCounter />
      <SlideCarousel />
      <TodoApp />
      <DesignSystemDemo />
    </div>
  );
}

// Render the app with SignalProvider for DevTools
const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <SignalProvider api={signalAPI}>
      <App />
    </SignalProvider>
  </React.StrictMode>
);
