/**
 * Example: Basic Redux adapter usage with the new pattern
 * 
 * Shows how to use Redux stores with Lattice following the separated pattern
 */

import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import type { StoreTools } from '@lattice/core';

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

// Define slices using pure Lattice syntax - no Redux knowledge needed!

const counter = createSlice(({ get, set }: StoreTools<AppState>) => ({
  // Selectors (queries)
  value: () => get().counter.value,
  isPositive: () => get().counter.value > 0,
  
  // Actions (mutations)
  increment: () => set({
    counter: { value: get().counter.value + 1 }
  }),
  decrement: () => set({
    counter: { value: get().counter.value - 1 }
  }),
  setValue: (value: number) => set({
    counter: { value }
  }),
}));

const todos = createSlice(({ get, set }: StoreTools<AppState>) => ({
  // Selectors
  all: () => get().todos.items,
  active: () => get().todos.items.filter(t => !t.completed),
  completed: () => get().todos.items.filter(t => t.completed),
  currentFilter: () => get().todos.filter,
  
  // Actions
  add: (text: string) => {
    const newTodo = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      completed: false,
    };
    set({
      todos: {
        ...get().todos,
        items: [...get().todos.items, newTodo],
      },
    });
  },
  
  toggle: (id: string) => {
    set({
      todos: {
        ...get().todos,
        items: get().todos.items.map(todo =>
          todo.id === id
            ? { ...todo, completed: !todo.completed }
            : todo
        ),
      },
    });
  },
  
  remove: (id: string) => {
    set({
      todos: {
        ...get().todos,
        items: get().todos.items.filter(todo => todo.id !== id),
      },
    });
  },
  
  setFilter: (filter: 'all' | 'active' | 'completed') => {
    set({
      todos: {
        ...get().todos,
        filter,
      },
    });
  },
}));

const user = createSlice(({ get, set }: StoreTools<AppState>) => ({
  // Selectors
  name: () => get().user.name,
  email: () => get().user.email,
  isLoggedIn: () => get().user.loggedIn,
  
  // Actions
  login: (name: string, email: string) => {
    set({
      user: { name, email, loggedIn: true },
    });
  },
  
  logout: () => {
    set({
      user: { name: '', email: '', loggedIn: false },
    });
  },
  
  updateEmail: (email: string) => {
    set({
      user: {
        ...get().user,
        email,
      },
    });
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
      }
    }
  });
  
  // Tell the adapter which slice to use
  const createAppSlice = reduxAdapter<AppState>(advancedStore, { slice: 'app' });
  
  // Now create slices that work with the 'app' portion of the state
  const appCounter = createAppSlice(({ get, set }) => ({
    value: () => get().counter.value,
    increment: () => set({ counter: { value: get().counter.value + 1 } })
  }));
  
  return { store: advancedStore, counter: appCounter };
}

// Usage example
export function demonstrateUsage() {
  console.log('=== Redux Adapter Example (New Pattern) ===\n');
  
  // Counter operations
  console.log('Counter value:', counter.selector.value()); // 0
  counter.selector.increment();
  counter.selector.increment();
  console.log('After increment:', counter.selector.value()); // 2
  console.log('Is positive?', counter.selector.isPositive()); // true
  
  // Todo operations
  todos.selector.add('Learn Lattice');
  todos.selector.add('Build an app');
  todos.selector.add('Deploy to production');
  
  console.log('\nTodos:', todos.selector.all().length); // 3
  
  const firstTodo = todos.selector.all()[0];
  todos.selector.toggle(firstTodo.id);
  
  console.log('Active:', todos.selector.active().length); // 2
  console.log('Completed:', todos.selector.completed().length); // 1
  
  // User operations
  user.selector.login('Alice', 'alice@example.com');
  console.log('\nLogged in as:', user.selector.name()); // Alice
  console.log('Email:', user.selector.email()); // alice@example.com
  
  // Redux store is automatically synchronized
  console.log('\nRedux state:', store.getState());
  
  // Subscribe to changes
  const unsubscribe = counter.subscribe(() => {
    console.log('Counter changed to:', counter.selector.value());
  });
  
  counter.selector.setValue(10);
  unsubscribe();
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