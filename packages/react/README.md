# @lattice/react

> React bindings for Lattice signals and stores

`@lattice/react` provides idiomatic React hooks and components for integrating [Lattice](https://github.com/latticejs/lattice) signals and stores into your React applications. It leverages React 18's features for optimal performance and developer experience.

## Features

- 🔗 **Simple hooks** - `useSubscribe`, `useSignal`, `useComputed`, `useStore`, and more
- � **Fine-grained reactivity** - Only re-render what changes
- <� **Optimal performance** - Built on React 18's `useSyncExternalStore`
- =� **Tree-shakeable** - Import only what you need
- =' **Full TypeScript support** - Complete type inference
- > � **Testing utilities** - First-class testing support

## Installation

```bash
npm install @lattice/react @lattice/signals @lattice/core
# or
yarn add @lattice/react @lattice/signals @lattice/core
# or
pnpm add @lattice/react @lattice/signals @lattice/core
```

## Quick Start

```tsx
import { useSubscribe, useComputed } from '@lattice/react';
import { signal } from '@lattice/signals';

// Create a signal
const count = signal(0);

function Counter() {
  // Subscribe to the signal
  const value = useSubscribe(count);

  // Create and subscribe to a computed value
  const doubled = useComputed(() => count.value * 2);
  const doubledValue = useSubscribe(doubled);

  return (
    <div>
      <p>Count: {value}</p>
      <p>Doubled: {doubledValue}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
```

## Signal Hooks

### `useSubscribe`

Subscribe to a signal, computed, or selected value.

```tsx
import { useSubscribe } from '@lattice/react';
import { signal } from '@lattice/signals';

const name = signal('John');

function Profile() {
  const currentName = useSubscribe(name);

  return <div>Hello, {currentName}!</div>;
}
```

### `useSignal`

Create a local signal with React component lifecycle.

```tsx
import { useSignal } from '@lattice/react';

function Form() {
  const [value, setValue] = useSignal('');

  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
```

### `useComputed`

Create a computed value that automatically tracks dependencies. Returns a Computed instance that can be subscribed to.

```tsx
import { useComputed, useSubscribe } from '@lattice/react';

function ShoppingCart({ items }) {
  const totalComputed = useComputed(() =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  const total = useSubscribe(totalComputed);

  return <div>Total: ${total}</div>;
}
```

### `useSignalEffect`

Create effects with automatic signal dependency tracking and cleanup. Unlike React's useEffect, dependencies are tracked automatically.

```tsx
import { useSignalEffect } from '@lattice/react';

function Logger({ message }) {
  useSignalEffect(() => {
    console.log('Message:', message.value);

    // Optional cleanup
    return () => console.log('Cleanup');
  });

  return null;
}
```

### `useSelector`

Select and subscribe to specific parts of a signal.

```tsx
import { useSelector } from '@lattice/react';

const userSignal = signal({
  name: 'John',
  email: 'john@example.com',
  preferences: { theme: 'dark' },
});

function UserName() {
  // Only re-renders when name changes
  const name = useSelector(userSignal, (user) => user.name);

  return <div>{name}</div>;
}
```

## Store Hooks and Components

### `LatticeProvider`

Provides a Lattice context for all child components.

```tsx
import { LatticeProvider } from '@lattice/react';

function App() {
  return (
    <LatticeProvider>
      <YourApp />
    </LatticeProvider>
  );
}
```

### `useStore`

Create and manage a store with component lifecycle.

```tsx
import { useStore } from '@lattice/react';
import { createStore } from '@lattice/core';

function TodoApp() {
  const store = useStore(() =>
    createStore({
      todos: [],
      filter: 'all',
    })
  );

  const todos = useSubscribe(store.state.todos);

  return (
    <div>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
```

### `StoreProvider` & `useStoreContext`

Share a store across components.

```tsx
import { StoreProvider, useStoreContext, useStoreState } from '@lattice/react';

const appStore = createStore({
  user: null,
  theme: 'light',
});

function App() {
  return (
    <StoreProvider store={appStore}>
      <Header />
      <Main />
    </StoreProvider>
  );
}

function Header() {
  const store = useStoreContext();
  const user = useSubscribe(store.state.user);

  return <div>Welcome, {user?.name || 'Guest'}</div>;
}

function ThemeToggle() {
  // Use selector for specific state
  const theme = useStoreState((state) => state.theme);
  const store = useStoreContext();

  return (
    <button
      onClick={() => {
        store.state.theme.value = theme === 'light' ? 'dark' : 'light';
      }}
    >
      Current theme: {theme}
    </button>
  );
}
```

## Advanced Patterns

### Fine-grained Subscriptions

Use selectors to minimize re-renders:

```tsx
const appState = signal({
  user: { name: 'John', age: 30 },
  posts: [],
  settings: { theme: 'dark' },
});

function UserAge() {
  // Only re-renders when age changes
  const age = useSelector(appState, (state) => state.user.age);

  return <div>Age: {age}</div>;
}

// With custom equality
function PostList() {
  const postCount = useSelector(
    appState,
    (state) => state.posts.length,
    // Only re-render if length actually changed
    (a, b) => a === b
  );

  return <div>Posts: {postCount}</div>;
}
```

### Batching Updates

Batch multiple updates to prevent unnecessary re-renders:

```tsx
import { batch } from '@lattice/signals';

function Form() {
  const [name, setName] = useSignal('');
  const [email, setEmail] = useSignal('');

  const handleReset = () => {
    batch(() => {
      setName('');
      setEmail('');
    });
  };

  return (
    <form>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={handleReset}>Reset</button>
    </form>
  );
}
```

### Custom Store Hooks

Create typed hooks for your stores:

```tsx
import { createStoreHook } from '@lattice/react';

interface AppState {
  user: User | null;
  posts: Post[];
  isLoading: boolean;
}

const useAppStore = createStoreHook<AppState>();

function PostCount() {
  const count = useAppStore((state) => state.posts.length);
  return <div>Total posts: {count}</div>;
}

function LoadingSpinner() {
  const isLoading = useAppStore((state) => state.isLoading);
  return isLoading ? <Spinner /> : null;
}
```

## Testing

`@lattice/react` provides testing utilities for components using signals and stores:

```tsx
import {
  renderWithLattice,
  renderHookWithLattice,
  createTestStore,
} from '@lattice/react/testing';
import { signal } from '@lattice/signals';
import { act } from '@testing-library/react';

// Test a component
test('Counter increments', () => {
  const count = signal(0);

  const { getByText } = renderWithLattice(<Counter signal={count} />);

  expect(getByText('Count: 0')).toBeInTheDocument();

  act(() => {
    count.value = 1;
  });

  expect(getByText('Count: 1')).toBeInTheDocument();
});

// Test a hook
test('useSubscribe updates', () => {
  const count = signal(0);

  const { result } = renderHookWithLattice(() => useSubscribe(count));

  expect(result.current).toBe(0);

  act(() => {
    count.value = 5;
  });

  expect(result.current).toBe(5);
});

// Test with a store
test('Store updates', () => {
  const store = createTestStore({ count: 0 });

  const { result } = renderHookWithLattice(
    () => useStoreState((s) => s.count),
    { store }
  );

  expect(result.current).toBe(0);

  act(() => {
    store.state.count.value = 10;
  });

  expect(result.current).toBe(10);
});
```

## Performance Tips

1. **Use selectors** for fine-grained subscriptions:

   ```tsx
   // L Subscribes to entire object
   const user = useSubscribe(userSignal);
   const name = user.name;

   //  Only subscribes to name
   const name = useSelector(userSignal, (u) => u.name);
   ```

2. **Memoize selector functions** to prevent recreating subscriptions:

   ```tsx
   // L Creates new selector on each render
   const filtered = useSelector(items, (items) =>
     items.filter((i) => i.active)
   );

   //  Stable selector
   const selectActive = useCallback(
     (items) => items.filter((i) => i.active),
     []
   );
   const filtered = useSelector(items, selectActive);
   ```

3. **Use computed values** instead of calculating in render:

   ```tsx
   // L Calculates on every render
   const total = items.reduce((sum, item) => sum + item.price, 0);

   //  Only recalculates when items change
   const total = useComputed(() =>
     items.reduce((sum, item) => sum + item.price, 0)
   );
   ```

## API Reference

### Signal Hooks

- `useSubscribe<T>(signal: SignalLike<T>): T`
- `useSignal<T>(initial: T): [T, (value: T) => void]`
- `useComputed<T>(fn: () => T, deps?: unknown[]): Computed<T>`
- `useSignalEffect(fn: () => void | (() => void)): void`
- `useSelector<T, R>(signal: Signal<T>, selector: (value: T) => R): R`

### Core Hooks

- `useLattice(): LatticeContext`
- `useStore<T>(factory: () => Store<T>): Store<T>`
- `useStoreContext<T>(): Store<T>`
- `useStoreState<T, R>(selector?: (state: T) => R): R`
- `createStoreHook<T>(): <R>(selector?: (state: T) => R) => R`

### Components

- `<LatticeProvider context?={lattice}>{children}</LatticeProvider>`
- `<StoreProvider store={store}>{children}</StoreProvider>`

### Testing Utilities

- `renderWithLattice(ui, options?)`
- `renderHookWithLattice(hook, options?)`
- `createTestStore(initialState)`

## TypeScript

The library is written in TypeScript and provides full type inference:

```tsx
// Types are inferred automatically
const count = signal(0); // Signal<number>
const doubled = computed(() => count.value * 2); // Computed<number>

function Counter() {
  const value = useSubscribe(count); // number
  const doubleComputed = useComputed(() => count.value * 2); // Computed<number>
  const double = useSubscribe(doubleComputed); // number

  return (
    <div>
      {value} × 2 = {double}
    </div>
  );
}

// With explicit types
interface User {
  id: string;
  name: string;
  email: string;
}

const userSignal = signal<User | null>(null);

function UserProfile() {
  const user = useSubscribe(userSignal); // User | null

  if (!user) return <div>Loading...</div>;

  return <div>{user.name}</div>;
}
```

## License

MIT
