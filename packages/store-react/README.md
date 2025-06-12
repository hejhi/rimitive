# @lattice/store-react

Lightweight, component-scoped state management for React. Zero dependencies, full TypeScript support, and automatic cleanup.

## Features

- 🚀 **Zero dependencies** - Just React, nothing else
- 🎯 **Component-scoped** - State lives and dies with your components
- 🧹 **Automatic cleanup** - No memory leaks, no manual cleanup needed
- 📦 **Tiny bundle** - Under 2KB gzipped
- 🔍 **Full TypeScript** - Complete type inference and safety
- ⚛️ **React 18+ optimized** - Built for concurrent features
- 🎨 **Fine-grained updates** - Only re-render what changes

## Installation

```bash
npm install @lattice/store-react
# or
yarn add @lattice/store-react
# or
pnpm add @lattice/store-react
```

## Quick Start

### Basic Counter

```tsx
import { useStore } from '@lattice/store-react';

function Counter() {
  const store = useStore((set, get) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    reset: () => set({ count: 0 })
  }));

  return (
    <div>
      <h1>{store.count}</h1>
      <button onClick={store.increment}>+</button>
      <button onClick={store.decrement}>-</button>
      <button onClick={store.reset}>Reset</button>
    </div>
  );
}
```

### With Selectors

```tsx
import { useStore, useStoreSelector } from '@lattice/store-react';

function TodoApp() {
  const store = useStore((set, get) => ({
    todos: [],
    filter: 'all',
    addTodo: (text) => set({ 
      todos: [...get().todos, { id: Date.now(), text, done: false }] 
    }),
    toggleTodo: (id) => set({
      todos: get().todos.map(t => 
        t.id === id ? { ...t, done: !t.done } : t
      )
    }),
    setFilter: (filter) => set({ filter })
  }));

  return <TodoList store={store} />;
}

function TodoList({ store }) {
  // Only re-renders when filtered todos change
  const todos = useStoreSelector(store, (s) => {
    if (s.filter === 'all') return s.todos;
    if (s.filter === 'active') return s.todos.filter(t => !t.done);
    return s.todos.filter(t => t.done);
  });

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.done}
            onChange={() => store.toggleTodo(todo.id)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

### With Context

```tsx
import { useStore, createStoreContext } from '@lattice/store-react';

// Create typed context
const AppStoreContext = createStoreContext();

function App() {
  const store = useStore((set, get) => ({
    user: null,
    theme: 'light',
    login: (user) => set({ user }),
    logout: () => set({ user: null }),
    toggleTheme: () => set({ 
      theme: get().theme === 'light' ? 'dark' : 'light' 
    })
  }));

  return (
    <AppStoreContext.Provider value={store}>
      <Header />
      <Main />
    </AppStoreContext.Provider>
  );
}

function Header() {
  const store = AppStoreContext.useStore();
  const user = useStoreSelector(store, s => s.user);
  
  return (
    <header>
      {user ? (
        <>
          <span>Welcome, {user.name}</span>
          <button onClick={store.logout}>Logout</button>
        </>
      ) : (
        <button onClick={() => store.login({ name: 'Guest' })}>
          Login
        </button>
      )}
    </header>
  );
}
```

## API Reference

### `useStore(creator)`

Creates a component-scoped store.

```tsx
const store = useStore((set, get) => ({
  // State
  count: 0,
  
  // Actions
  increment: () => set({ count: get().count + 1 })
}));
```

**Parameters:**
- `creator: (set, get) => Store` - Function that creates your store
  - `set: (updates: Partial<State>) => void` - Update state
  - `get: () => State` - Get current state

**Returns:** Store instance with state, actions, and API methods:
- `getState()` - Get current state
- `setState(updates)` - Update state
- `subscribe(listener)` - Subscribe to changes
- `destroy()` - Cleanup (called automatically)

### `useStoreSelector(store, selector, equalityFn?)`

Subscribe to specific parts of the store.

```tsx
const count = useStoreSelector(store, s => s.count);
const todos = useStoreSelector(
  store, 
  s => s.todos.filter(t => !t.done),
  shallowEqual // Optional custom equality
);
```

**Parameters:**
- `store` - Store instance from `useStore`
- `selector` - Function to select value from state
- `equalityFn` - Optional equality function (default: `Object.is`)

### `useStoreSubscribe(store, callback)`

Subscribe to all store changes. Useful for side effects.

```tsx
useStoreSubscribe(store, (state) => {
  console.log('State changed:', state);
  localStorage.setItem('app-state', JSON.stringify(state));
});
```

### `createStoreContext<Store>()`

Create a typed context for your store.

```tsx
const MyStoreContext = createStoreContext<MyStore>();

// Returns:
// - Provider: Context.Provider component
// - Consumer: Context.Consumer component  
// - useStore: Hook to access store from context
```

### `createStoreProvider<Store>()`

Create a provider component and hook pair.

```tsx
const { StoreProvider, useStore } = createStoreProvider<MyStore>();
```

### `shallowEqual(a, b)`

Shallow equality helper for use with `useStoreSelector`.

```tsx
const selection = useStoreSelector(
  store,
  s => ({ count: s.count, name: s.name }),
  shallowEqual
);
```

## Patterns & Best Practices

### Organizing Complex Stores

```tsx
// Separate concerns with multiple stores
function useAuthStore() {
  return useStore((set, get) => ({
    user: null,
    token: null,
    login: async (credentials) => {
      const response = await api.login(credentials);
      set({ user: response.user, token: response.token });
    },
    logout: () => set({ user: null, token: null })
  }));
}

function useUIStore() {
  return useStore((set, get) => ({
    sidebarOpen: false,
    modal: null,
    toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: null })
  }));
}
```

### Computed Values

```tsx
const store = useStore((set, get) => ({
  items: [],
  filter: '',
  
  // Actions
  addItem: (item) => set({ items: [...get().items, item] }),
  setFilter: (filter) => set({ filter }),
  
  // Computed values as getters
  get filteredItems() {
    const { items, filter } = get();
    return items.filter(item => 
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  },
  
  get itemCount() {
    return get().items.length;
  }
}));
```

### Async Actions

```tsx
const store = useStore((set, get) => ({
  data: null,
  loading: false,
  error: null,
  
  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getData();
      set({ data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  }
}));
```

### Middleware Pattern

```tsx
function createStoreWithLogger(creator) {
  return (set, get) => {
    const setState = (updates) => {
      console.log('State update:', updates);
      set(updates);
    };
    
    return creator(setState, get);
  };
}

const store = useStore(
  createStoreWithLogger((set, get) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 })
  }))
);
```

## React Native

Works perfectly with React Native out of the box:

```tsx
import { useStore } from '@lattice/store-react';
import { View, Text, Button } from 'react-native';

function CounterApp() {
  const store = useStore((set, get) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 })
  }));

  return (
    <View>
      <Text>Count: {store.count}</Text>
      <Button title="Increment" onPress={store.increment} />
    </View>
  );
}
```

## Comparison with Other Libraries

### vs Zustand
- **store-react**: Component-scoped, automatic cleanup, zero deps
- **Zustand**: Global stores, manual cleanup, requires zustand dep

### vs Redux
- **store-react**: No boilerplate, no providers required, component-scoped
- **Redux**: Global state, actions/reducers pattern, requires setup

### vs Context API
- **store-react**: No re-render issues, fine-grained updates, better performance
- **Context**: Can cause unnecessary re-renders, no built-in optimizations

## TypeScript

Full TypeScript support with automatic type inference:

```tsx
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

interface TodoStore {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  removeTodo: (id: number) => void;
}

const store = useStore<TodoStore>((set, get) => ({
  todos: [],
  addTodo: (text) => set({ 
    todos: [...get().todos, { id: Date.now(), text, done: false }] 
  }),
  toggleTodo: (id) => set({
    todos: get().todos.map(t => 
      t.id === id ? { ...t, done: !t.done } : t
    )
  }),
  removeTodo: (id) => set({
    todos: get().todos.filter(t => t.id !== id)
  })
}));
```

## Performance Tips

1. **Use selectors** for fine-grained subscriptions
2. **Use `shallowEqual`** when selecting objects
3. **Memoize complex selectors** with `useMemo`
4. **Split large stores** into smaller, focused ones
5. **Avoid inline selectors** in hot paths

## License

MIT