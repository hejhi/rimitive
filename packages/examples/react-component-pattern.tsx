/**
 * Example: Using the Component Pattern in React
 *
 * This demonstrates how to use Lattice components (from the devtools example)
 * in a React application using the useComponent hook.
 *
 * The same components work in Vue, Svelte, or vanilla JS - you just change
 * the framework adapter!
 */

import { useComponent, useSubscribe, SignalProvider } from '@lattice/react';
import { createCounter } from './devtools/src/components/counter';
import { createTodoList } from './devtools/src/components/todo-list';
import { createFilter } from './devtools/src/components/filter';

/**
 * Example 1: Step Counter
 * Using the counter component to track steps in a process
 */
function StepCounter() {
  const counter = useComponent(createCounter);
  const step = useSubscribe(counter.count);
  const isEven = useSubscribe(counter.isEven);

  return (
    <div>
      <h2>Installation Steps</h2>
      <p>
        Step {step} / 5 {isEven ? '(Even step)' : '(Odd step)'}
      </p>
      <button onClick={counter.decrement} disabled={step === 0}>
        Previous
      </button>
      <button onClick={counter.increment} disabled={step === 5}>
        Next
      </button>
    </div>
  );
}

/**
 * Example 2: Slide Carousel
 * Same counter component, different use case
 */
function SlideCarousel({ slides }: { slides: string[] }) {
  const counter = useComponent(createCounter);
  const current = useSubscribe(counter.count);

  return (
    <div>
      <h2>Slides</h2>
      <div>{slides[current] || 'No slide'}</div>
      <button onClick={counter.decrement} disabled={current === 0}>
        ← Previous
      </button>
      <span>
        {current + 1} / {slides.length}
      </span>
      <button onClick={counter.increment} disabled={current >= slides.length - 1}>
        Next →
      </button>
    </div>
  );
}

/**
 * Example 3: Todo Application
 * Using todoList + filter components together
 */
function TodoApp() {
  // Create component instances with initialization
  const todoList = useComponent(createTodoList, [
    { id: 1, text: 'Learn Lattice', completed: false },
    { id: 2, text: 'Build an app', completed: false },
  ]);

  const filter = useComponent(createFilter);

  // Subscribe to reactive values
  const allTodos = useSubscribe(todoList.todos);
  const activeCount = useSubscribe(todoList.activeCount);
  const currentFilter = useSubscribe(filter.currentFilter);

  // Get filtered todos
  const filteredTodos = filter.filterTodos(allTodos);

  return (
    <div>
      <h2>Todos</h2>

      <input
        type="text"
        placeholder="Add todo..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            todoList.addTodo(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />

      <div>
        <button
          onClick={() => filter.setFilter('all')}
          disabled={currentFilter === 'all'}
        >
          All
        </button>
        <button
          onClick={() => filter.setFilter('active')}
          disabled={currentFilter === 'active'}
        >
          Active
        </button>
        <button
          onClick={() => filter.setFilter('completed')}
          disabled={currentFilter === 'completed'}
        >
          Completed
        </button>
      </div>

      <ul>
        {filteredTodos.map((todo) => (
          <li
            key={todo.id}
            onClick={() => todoList.toggleTodo(todo.id)}
            style={{
              textDecoration: todo.completed ? 'line-through' : 'none',
              cursor: 'pointer',
            }}
          >
            {todo.text}
          </li>
        ))}
      </ul>

      <p>{activeCount} active todos</p>
      <button onClick={todoList.toggleAll}>Toggle All</button>
    </div>
  );
}

/**
 * Root App with SignalProvider
 */
export function App() {
  return (
    <SignalProvider>
      <div style={{ padding: '2rem' }}>
        <h1>Component Pattern Examples</h1>

        <div style={{ marginBottom: '2rem' }}>
          <StepCounter />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <SlideCarousel
            slides={[
              'Introduction to Lattice',
              'Creating Components',
              'Using in React',
              'Using in Vue',
              'Building a Design System',
            ]}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <TodoApp />
        </div>
      </div>
    </SignalProvider>
  );
}

/**
 * Key Takeaways:
 *
 * 1. Components are defined once (createCounter, createTodoList, createFilter)
 * 2. They work in ANY framework - React, Vue, Svelte, vanilla JS
 * 3. useComponent creates the instance and handles lifecycle
 * 4. useSubscribe connects to reactive values for re-renders
 * 5. The same counter component powers both StepCounter and SlideCarousel
 * 6. Components compose together (filter + todoList)
 *
 * This is the foundation for building a framework-agnostic design system!
 */
