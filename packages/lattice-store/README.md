# @lattice/store

Core state management for Lattice - framework-agnostic with React bindings.

## What it is

- 🎯 **Framework-agnostic core**: Vanilla state management with fine-grained reactivity
- ⚛️ **React bindings**: First-class React support with hooks and concurrent features
- 🔄 **Slice composition**: Build complex state from simple, reactive slices
- 📦 **Tiny**: Under 3KB gzipped with zero dependencies
- 🔍 **Full TypeScript**: Complete type inference and safety

## Installation

```bash
npm install @lattice/store
```

## Usage

### Vanilla (Framework-agnostic)

```typescript
import { createStore, createVanillaStore } from '@lattice/store';

// Simple API (like Zustand)
const store = createVanillaStore((set, get) => ({
  count: 0,
  increment: () => set({ count: get().count + 1 })
}));

store.getState(); // { count: 0 }
store.setState({ count: 5 });
const unsub = store.subscribe(() => console.log('changed'));

// Advanced reactive slices
const createSlice = createStore({ count: 0, user: null });

const counter = createSlice(
  (selectors) => ({ count: selectors.count }),
  ({ count }, set) => ({
    value: () => count(),
    increment: () => set(
      (selectors) => ({ count: selectors.count }),
      ({ count }) => ({ count: count() + 1 })
    )
  })
);
```

### React

```typescript
import { useStore, useStoreSelector } from '@lattice/store/react';

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

// With selectors for performance
function CountDisplay({ store }) {
  // Only re-renders when count changes
  const count = useStoreSelector(store, s => s.count);
  
  return <div>Count: {count}</div>;
}
```

### Context Pattern

```typescript
import { useStore, createStoreContext } from '@lattice/store/react';

const AppStoreContext = createStoreContext();

function App() {
  const store = useStore((set, get) => ({
    user: null,
    theme: 'light',
    login: (user) => set({ user }),
    toggleTheme: () => set({ 
      theme: get().theme === 'light' ? 'dark' : 'light' 
    })
  }));

  return (
    <AppStoreContext.Provider value={store}>
      <YourApp />
    </AppStoreContext.Provider>
  );
}
```

## API

### Vanilla API

- `createStore(initialState)` - Creates a reactive slice factory
- `createVanillaStore(initializer)` - Creates a simple store (Zustand-like API)

### React API

- `useStore(creator)` - Create a component-scoped store
- `useStoreSelector(store, selector, equalityFn?)` - Subscribe to store slices
- `useStoreSubscribe(store, callback)` - Subscribe to all changes
- `createStoreContext()` - Create typed context for store sharing
- `shallowEqual` - Equality helper for object selections

## Why use this?

### vs Redux/Zustand
- Component-scoped by default (not global)
- Fine-grained reactivity built-in
- Simpler API with full TypeScript inference

### vs React Context
- 10-100x better performance for frequently updating state
- Fine-grained subscriptions prevent unnecessary re-renders
- No provider hierarchy complexity

### vs MobX
- No decorators or configuration needed
- Explicit, predictable state updates
- Smaller bundle size

## Advanced: Integration with Lattice Runtime

The vanilla store can be used as an adapter with Lattice's runtime system:

```typescript
import { createStore } from '@lattice/store';
import { createLatticeStore } from '@lattice/core';

// Use as a base for Lattice's adapter system
const store = createStore({ count: 0 });
const latticeStore = createLatticeStore({
  getState: () => /* adapt */,
  setState: (updates) => /* adapt */,
  subscribe: (listener) => /* adapt */
});
```

## TypeScript

Fully typed out of the box:

```typescript
interface TodoStore {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
}

const store = useStore<TodoStore>((set, get) => ({
  todos: [],
  addTodo: (text) => set({ 
    todos: [...get().todos, { id: Date.now(), text, done: false }] 
  }),
  toggleTodo: (id) => set({
    todos: get().todos.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    )
  })
}));
```

## License

MIT