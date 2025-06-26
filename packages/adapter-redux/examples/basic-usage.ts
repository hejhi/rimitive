/**
 * Example: Basic Redux adapter usage with the two-phase reactive pattern
 *
 * Shows how to use Redux stores with Lattice following the reactive slice API
 */

import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import { select as $ } from '@lattice/core';

// Define your state shape
interface AppState {
  counter: { value: number };
  todos: {
    items: Array<{ id: string; text: string; completed: boolean }>;
    filter: 'all' | 'active' | 'completed';
  };
  user: {
    name: string;
    email: string;
    loggedIn: boolean;
  };
}

// NEW PATTERN: Create your Redux store separately with Redux's native API
const store = configureStore({
  reducer: latticeReducer.reducer,
  preloadedState: {
    counter: { value: 0 },
    todos: { items: [], filter: 'all' },
    user: { name: '', email: '', loggedIn: false },
  },
  // You can add any Redux middleware you want
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  // Redux DevTools work automatically
  devTools: process.env.NODE_ENV !== 'production',
});

// Wrap the store with the Lattice adapter
const createSlice = reduxAdapter<AppState>(store);

// Define slices using the two-phase reactive pattern

const counter = createSlice(
  // Phase 1: Declare dependencies
  $('counter'),
  // Phase 2: Define computed values and actions
  ({ counter }, set) => ({
    // Selectors (queries)
    value: () => counter().value,
    isPositive: () => counter().value > 0,

    // Actions (mutations)
    increment: () =>
      set(({ counter }) => ({
        counter: { value: counter().value + 1 },
      })),
    decrement: () =>
      set(({ counter }) => ({
        counter: { value: counter().value - 1 },
      })),
    setValue: (value: number) => set(() => ({ counter: { value } })),
  })
);

const todos = createSlice($('todos'), ({ todos }, set) => ({
  // Selectors
  all: () => todos().items,
  active: () => todos().items.filter((t) => !t.completed),
  completed: () => todos().items.filter((t) => t.completed),
  currentFilter: () => todos().filter,

  // Actions
  add: (text: string) => {
    const newTodo = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      completed: false,
    };
    set(({ todos }) => ({
      todos: {
        ...todos(),
        items: [...todos().items, newTodo],
      },
    }));
  },

  toggle: (id: string) => {
    set(({ todos }) => ({
      todos: {
        ...todos(),
        items: todos().items.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        ),
      },
    }));
  },

  remove: (id: string) => {
    set(({ todos }) => ({
      todos: {
        ...todos(),
        items: todos().items.filter((todo) => todo.id !== id),
      },
    }));
  },

  setFilter: (filter: 'all' | 'active' | 'completed') => {
    set(({ todos }) => ({
      todos: {
        ...todos(),
        filter,
      },
    }));
  },
}));

const user = createSlice($('user'), ({ user }, set) => ({
  // Selectors
  name: () => user().name,
  email: () => user().email,
  isLoggedIn: () => user().loggedIn,

  // Actions
  login: (name: string, email: string) => {
    set(() => ({ user: { name, email, loggedIn: true } }));
  },

  logout: () => {
    set(() => ({ user: { name: '', email: '', loggedIn: false } }));
  },

  updateEmail: (email: string) => {
    set(({ user }) => ({
      user: {
        ...user(),
        email,
      },
    }));
  },
}));

// Advanced example: Using Redux store with multiple slices
export function advancedExample() {
  // You can combine Lattice with other Redux slices
  const advancedStore = configureStore({
    reducer: {
      // Lattice manages this slice
      app: latticeReducer.reducer,
      // Other Redux slices can coexist
      // auth: authSlice.reducer,
      // api: apiSlice.reducer,
    },
    preloadedState: {
      app: {
        counter: { value: 0 },
        todos: { items: [], filter: 'all' },
        user: { name: '', email: '', loggedIn: false },
      },
    },
  });

  // Tell the adapter which slice to use
  const createAppSlice = reduxAdapter<AppState>(advancedStore, {
    slice: 'app',
  });

  // Now create slices that work with the 'app' portion of the state
  const appCounter = createAppSlice($('counter'), ({ counter }, set) => ({
    value: () => counter().value,
    increment: () =>
      set(({ counter }) => ({
        counter: { value: counter().value + 1 },
      })),
  }));

  return { store: advancedStore, counter: appCounter };
}

// Usage example
export async function demonstrateUsage() {
  console.log('=== Redux Adapter Example (Two-Phase Pattern) ===\n');

  // Counter operations
  console.log('Counter value:', counter().value()); // 0
  counter().increment();
  counter().increment();
  console.log('After increment:', counter().value()); // 2
  console.log('Is positive?', counter().isPositive()); // true

  // Todo operations
  todos().add('Learn Lattice');
  todos().add('Build an app');
  todos().add('Deploy to production');

  console.log('\nTodos:', todos().all().length); // 3

  const firstTodo = todos().all()[0];
  if (firstTodo) {
    todos().toggle(firstTodo.id);
  }

  console.log('Active:', todos().active().length); // 2
  console.log('Completed:', todos().completed().length); // 1

  // User operations
  user().login('Alice', 'alice@example.com');
  console.log('\nLogged in as:', user().name()); // Alice
  console.log('Email:', user().email()); // alice@example.com

  // Redux store is automatically synchronized
  console.log('\nRedux state:', store.getState());

  // Update the counter
  counter().setValue(10);
  console.log('Counter changed to:', counter().value());
}

// Benefits of the new pattern:
// 1. Full control over Redux store configuration
// 2. Can integrate with existing Redux applications
// 3. Use any Redux middleware or enhancers
// 4. Combine Lattice with other Redux slices
// 5. Better separation of concerns
// 6. Maintains all Redux DevTools support

if (typeof require !== 'undefined' && require.main === module) {
  demonstrateUsage();
}
