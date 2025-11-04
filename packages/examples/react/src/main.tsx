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
import { createApi } from '@lattice/lattice';
import { createSignalFactory, SignalOpts } from '@lattice/signals/signal';
import { createComputedFactory, ComputedOpts } from '@lattice/signals/computed';
import { createEffectFactory, EffectOpts } from '@lattice/signals/effect';
import { createBatchFactory, BatchOpts } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import { devtoolsProvider, createInstrumentation } from '@lattice/lattice';

// Import our React-compatible components
import { createCounter } from './components/counter';
import { createTodoList } from './components/todo-list';
import { createFilter } from './components/filter';
import { createAppState } from './components/app-state';
import { Modal } from './design-system/Modal';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

// ============================================================================
// Create Instrumented Signal API with DevTools
// ============================================================================

function createContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const { withPropagate, dispose, startBatch, endBatch } = createScheduler({ detachAll });
  const pullPropagator = createPullPropagator({ track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: false })],
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

// Create signal API instance with instrumentation
const signalAPI = createApi(
  {
    signal: (opts: SignalOpts) =>
      createSignalFactory({ ...opts, instrument: instrumentSignal }),
    computed: (opts: ComputedOpts) =>
      createComputedFactory({ ...opts, instrument: instrumentComputed }),
    effect: (opts: EffectOpts) =>
      createEffectFactory({ ...opts, instrument: instrumentEffect }),
    batch: (opts: BatchOpts) =>
      createBatchFactory({ ...opts, instrument: instrumentBatch }),
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
        <button onClick={() => counter.decrement()} disabled={step === 0}>
          ← Previous Step
        </button>
        <button onClick={() => counter.increment()} disabled={step === 5}>
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
        <button onClick={() => counter.decrement()} disabled={current === 0}>
          ←
        </button>
        <span style={{ margin: '0 1rem' }}>
          Slide {current + 1} / {slides.length}
        </span>
        <button onClick={() => counter.increment()} disabled={current >= slides.length - 1}>
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
        <button onClick={() => todoList.toggleAll()}>
          {allCompleted ? 'Mark all active' : 'Mark all complete'}
        </button>
      </div>
    </div>
  );
}

/**
 * Example 4: Fine-Grained Reactivity Demo
 * Shows that we don't have React Context re-render problems
 */
function FineGrainedReactivityDemo() {
  const appState = useComponent(createAppState);

  // Track render counts
  const renderCounts = React.useRef({
    userName: 0,
    userEmail: 0,
    theme: 0,
    clicks: 0,
  });

  const UserNameDisplay = () => {
    renderCounts.current.userName++;
    const name = useSubscribe(appState.userName);
    return (
      <div style={{ padding: '0.5rem', background: '#e7f3ff', borderRadius: '4px' }}>
        <strong>User Name:</strong> {name}
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          Renders: {renderCounts.current.userName}
        </div>
      </div>
    );
  };

  const UserEmailDisplay = () => {
    renderCounts.current.userEmail++;
    const email = useSubscribe(appState.userEmail);
    return (
      <div style={{ padding: '0.5rem', background: '#fff3cd', borderRadius: '4px' }}>
        <strong>User Email:</strong> {email}
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          Renders: {renderCounts.current.userEmail}
        </div>
      </div>
    );
  };

  const ThemeDisplay = () => {
    renderCounts.current.theme++;
    const theme = useSubscribe(appState.theme);
    return (
      <div style={{ padding: '0.5rem', background: '#d4edda', borderRadius: '4px' }}>
        <strong>Theme:</strong> {theme}
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          Renders: {renderCounts.current.theme}
        </div>
      </div>
    );
  };

  const ClicksDisplay = () => {
    renderCounts.current.clicks++;
    const clicks = useSubscribe(appState.clickCount);
    return (
      <div style={{ padding: '0.5rem', background: '#f8d7da', borderRadius: '4px' }}>
        <strong>Click Count:</strong> {clicks}
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          Renders: {renderCounts.current.clicks}
        </div>
      </div>
    );
  };

  return (
    <div className="example-section">
      <h2>Fine-Grained Reactivity Demo</h2>
      <p>
        Watch the render counts below. Unlike React Context, <strong>only the component
        subscribed to a changed signal will re-render!</strong>
      </p>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
        <UserNameDisplay />
        <UserEmailDisplay />
        <ThemeDisplay />
        <ClicksDisplay />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => appState.setUserName(`User${Math.floor(Math.random() * 100)}`)}>
          Change User Name
        </button>
        <button onClick={() => appState.setUserEmail(`user${Math.floor(Math.random() * 100)}@example.com`)}>
          Change Email
        </button>
        <button onClick={() => appState.toggleTheme()}>
          Toggle Theme
        </button>
        <button onClick={() => appState.incrementClicks()}>
          Increment Clicks
        </button>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#e7f3ff', borderRadius: '4px' }}>
        <strong>🎯 Key Point:</strong> With traditional React Context, changing any value would
        cause ALL four components to re-render. With Lattice signals, only the specific component
        subscribed to the changed signal re-renders. This is <strong>fine-grained reactivity</strong>!
      </div>
    </div>
  );
}

/**
 * Example 5: Design System Pattern - Isolated State
 * Each Modal has its own signal instance, but shares the reactive infrastructure
 */
function DesignSystemDemo() {
  return (
    <div className="example-section">
      <h2>Design System Pattern - Isolated State</h2>
      <p>
        Each <code>Modal</code> component has its own signal instance,
        similar to how React's <code>useState</code> gives each component isolated state.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Modal title="User Settings">
          <p>This modal has its own isolated state (signal instance).</p>
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
          <p>It has its own signal instance, totally isolated from the first modal.</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button style={{ flex: 1 }}>Cancel</button>
            <button style={{ flex: 1, background: '#dc3545' }}>Delete</button>
          </div>
        </Modal>

        <Modal title="Help & Documentation">
          <h3 style={{ marginTop: 0 }}>How to use Lattice</h3>
          <p>This modal demonstrates how design system components can:</p>
          <ul>
            <li>Have their own encapsulated state (separate signal instances)</li>
            <li>Work independently from other instances</li>
            <li>Share the reactive infrastructure (one reactive graph)</li>
            <li>Still integrate with DevTools for debugging</li>
          </ul>
        </Modal>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#e7f3ff', borderRadius: '4px' }}>
        <strong>Key Pattern:</strong> Each <code>{'<Modal>'}</code> creates its own
        signal instance via <code>useComponent(createModal)</code>, giving it isolated state.
        All modals share the parent's reactive infrastructure (GlobalContext, scheduler).
        This is like React's <code>useState</code> - each component gets isolated state,
        but all use the same React reconciliation system. Perfect for reusable design
        system components!
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
            <strong>Shared Infrastructure:</strong> All components use the same SignalProvider
            (one reactive graph, one scheduler, one GlobalContext)
          </li>
          <li>
            <strong>Isolated State:</strong> Each component instance (<code>Counter</code>, <code>Modal</code>, etc.)
            gets its own signal instances, like React's <code>useState</code>
          </li>
          <li>
            <strong>Framework Agnostic:</strong> All behaviors work in React, Vue, Svelte, or vanilla JS
          </li>
        </ul>
      </div>

      <StepCounter />
      <SlideCarousel />
      <TodoApp />
      <FineGrainedReactivityDemo />
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
