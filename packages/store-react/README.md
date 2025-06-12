# @lattice/store-react

A tiny, fast state management library for React. Like Zustand, but designed for local component state and as a more efficient Context replacement.

## What it is

- 🎯 **Component-scoped state**: Fast enough to replace `useState` for complex local state (_not_ a global state manager)
- 🚀 **Context replacement**: React Context with fine-grained updates and subscriptions, perfect for creating headless components with provider patterns
- 👋 **Familiar API**: Familiar patterns, but without global stores
- 📦 **Tiny**: Under 2KB gzipped with zero dependencies
- 🔍 **Full TypeScript** - Complete type inference and safety
- ⚛️ **React 18+ optimized** - Built for concurrent features
- ✅ **Lattice compatible**: Works seamlessly as a Lattice adapter

## Installation

```bash
npm install @lattice/store-react
```

## Quick Start

### As Local State

```tsx
import { useStore } from '@lattice/store-react';

function Counter() {
  const store = useStore((set, get) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));

  return (
    <div>
      <h1>{store.count}</h1>
      <button onClick={store.increment}>+</button>
      <button onClick={store.decrement}>-</button>
    </div>
  );
}
```

### As Context Replacement

```tsx
import { useStore, createStoreContext } from '@lattice/store-react';

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
        <button onClick={store.logout}>Logout</button>
      ) : (
        <button onClick={() => store.login({ name: 'Guest' })}>Login</button>
      )}
    </header>
  );
}
```

### With Selectors

```tsx
function TodoList({ store }) {
  // Only re-renders when active todos change
  const activeTodos = useStoreSelector(
    store, 
    s => s.todos.filter(t => !t.done)
  );

  return (
    <ul>
      {activeTodos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

## API

### Core Functions

- `useStore(creator)` - Create a store instance
- `useStoreSelector(store, selector, equalityFn?)` - Subscribe to store slices
- `useStoreSubscribe(store, callback)` - Subscribe to all changes
- `createStoreContext()` - Create typed context for store sharing
- `shallowEqual` - Equality helper for object selections

## Why use this?

### vs useState
- Better for complex state with multiple sub-values
- Built-in performance optimizations
- Cleaner API for state that changes together

### vs React Context Alone
- Efficient context re-renders
- Fine-grained subscriptions
- 10-100x better performance for frequently updating state

### vs Zustand
- Designed for component-scoped state
- Automatic cleanup as part of the component lifecycle
- Not for global stores

## With Lattice

```tsx
import { createStoreReactAdapter } from '@lattice/adapter-store-react';

const createComponent = (createStore) => {
  const createSlice = createStore({ count: 0 });
  
  const counter = createSlice(({ get, set }) => ({
    value: () => get().count,
    increment: () => set({ count: get().count + 1 })
  }));
  
  return { counter };
};

// Use as a Lattice adapter
const store = createStoreReactAdapter(createComponent);
```

## TypeScript

Fully typed out of the box:

```tsx
const store = useStore<{
  todos: Todo[];
  addTodo: (text: string) => void;
}>((set, get) => ({
  todos: [],
  addTodo: (text) => set({ 
    todos: [...get().todos, { id: Date.now(), text, done: false }] 
  })
}));

```

## License

MIT