# @lattice/core

Build headless, portable, incredibly fast and reactive components that compose...without components. State management are stores of packaged signals that can scale from simple counters to complex applications. Components are just a functional pattern. Use like React Context, but with fine-grained updates, and in whatever framework you want.

```typescript
import { createStore } from '@lattice/core';

function Counter(store: Store<{ count: number }>) {
  return {
    increment: () => store.state.count.value++,
    get count() {
      return store.state.count.value;
    },
  };
}

const store = createStore({ count: 0 });
const counter = Counter(store);

counter.increment(); // count is now 1
```

## Installation

```bash
npm install @lattice/core
```

## Features

- **Component-first** - Build composable, UI-agnostic units with clear state boundaries
- **Isolated contexts** - Each store context gets its own reactive scope
- **Type-safe** - Full TypeScript inference from state to API
- **SSR-ready** - Request isolation built in
- **Framework agnostic** - Use with whatever you want, even vanilla JS

## Core Concepts

### Stores

Stores hold reactive state (as signals) and provide batched updates. Each property becomes a signal. Use `store.set` to batch update signals using a familiar api. Or update individual signals directly, it's all good.

```typescript
const store = createStore({
  user: { name: 'Alice', role: 'admin' },
  settings: { theme: 'dark', notifications: true },
});

// Direct signal access
console.log(store.state.user.value.name); // 'Alice'

// Batched updates
store.set({
  user: { name: 'Bob', role: 'user' },
  settings: { theme: 'light', notifications: true },
});

// Functional updates
store.set((current) => ({
  settings: { ...current.settings, theme: 'dark' },
}));
```

### Components

Components are plain functions that receive a store and return your API. They encapsulate behavior and can compose with other components.

```typescript
interface TodoState {
  todos: Todo[];
  filter: 'all' | 'active' | 'done';
}

function TodoList(store: Store<TodoState>) {
  const ctx = store.getContext();

  const filtered = ctx.computed(() => {
    const todos = store.state.todos.value;
    const filter = store.state.filter.value;

    if (filter === 'all') return todos;
    return todos.filter((t) => (filter === 'active' ? !t.done : t.done));
  });

  return {
    addTodo: (text: string) => {
      const todo = { id: Date.now(), text, done: false };
      store.state.todos.value = [...store.state.todos.value, todo];
    },

    toggleTodo: (id: number) => {
      const todos = store.state.todos.value;
      const index = todos.findIndex((t) => t.id === id);
      if (index >= 0) {
        const todo = todos[index];
        store.state.todos.set(index, { ...todo, done: !todo.done });
      }
    },

    setFilter: (filter: 'all' | 'active' | 'done') => {
      store.state.filter.value = filter;
    },

    get filtered() {
      return filtered.value;
    },
  };
}
```

### Contexts

Every store has an isolated context for signals, computed values, and effects. You can also create standalone contexts. Or just use stores directly.

```typescript
const store = createStore({ count: 0 });
const ctx = store.getContext();

// Create reactive values in this context
const doubled = ctx.computed(() => store.state.count.value * 2);

// Effects run in context
ctx.effect(() => {
  console.log(`Count: ${store.state.count.value}`);
});

// Or create a standalone context
const context = createLattice();
const name = context.signal('Alice');
const greeting = context.computed(() => `Hello, ${name.value}`);

// Clean up everything
store.dispose();
context.dispose();
```

## Patterns

### Composing Components

Components can use other components, creating larger abstractions from smaller ones.

```typescript
interface TimerState {
  elapsed: number;
  running: boolean;
}

function Timer(store: Store<TimerState>) {
  const ctx = store.getContext();
  let interval: number | null = null;

  ctx.effect(() => {
    if (store.state.running.value) {
      interval = setInterval(() => {
        store.state.elapsed.value++;
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
      interval = null;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  });

  return {
    start: () => (store.state.running.value = true),
    stop: () => (store.state.running.value = false),
    reset: () => store.set({ elapsed: 0, running: false }),
  };
}

// Use in a larger component
interface PomodoroState {
  workTime: number;
  breakTime: number;
  isBreak: boolean;
}

function Pomodoro(store: Store<PomodoroState>) {
  // Compose with Timer
  const timerStore = createStore(
    { elapsed: 0, running: false },
    store.getContext() // Share context
  );
  const timer = Timer(timerStore);

  return {
    timer,
    switchMode: () => {
      timer.reset();
      store.state.isBreak.value = !store.state.isBreak.value;
    },
  };
}
```

### Async Operations

Handle async operations with effects and state updates.

```typescript
interface UserProfileState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

function UserProfile(store: Store<UserProfileState>) {
  return {
    async loadUser(id: string) {
      store.set({ loading: true, error: null });

      try {
        const user = await fetchUser(id);
        store.set({ user, loading: false });
      } catch (err) {
        store.set({
          error: err.message,
          loading: false,
        });
      }
    },
  };
}
```

### Middleware-Ready

"Middleware" can wrap a store to intercept the api, and wrap or use as needed. For instance, using `effect` to log updates.

```tsx
const enhancedStore = someLogger(createStore({ count: 0 }));

function UserProfile(store: Store<UserProfileState>) {
  return {
    async loadUser(id: string) {
      store.set({ loading: true, error: null });

      try {
        const user = await fetchUser(id);
        store.set({ user, loading: false });
      } catch (err) {
        store.set({
          error: err.message,
          loading: false,
        });
      }
    },
  };
}

UserProfile(enchancedStore);
```

### Testing Components

Components are easy to test since they're just functions.

```typescript
test('Counter increments', () => {
  const store = createStore({ count: 0 });
  const counter = Counter(store);

  expect(store.state.count.value).toBe(0);

  counter.increment();
  expect(store.state.count.value).toBe(1);

  store.dispose();
});
```

### Partial Updates

Use the `partial` helper for single-property updates.

```typescript
import { partial } from '@lattice/core';

function Settings(store: Store<{ theme: string; fontSize: number }>) {
  return {
    setTheme: (theme: string) => {
      store.set(partial('theme', theme));
    },
    increaseFontSize: () => {
      store.set((current) => partial('fontSize', current.fontSize + 1));
    },
  };
}
```

### Server-Side Rendering

Each request gets its own isolated context. The same as you would with signals, but scope a component instead.

```typescript
// Next.js API route
export async function GET(request: Request) {
  // Create isolated context for this request
  const ctx = createLattice();
  const store = createStore({
    posts: await db.posts.findMany()
  }, ctx);

  const blog = BlogComponent(store);
  const html = renderToString(<Blog {...blog} />);

  // Clean up
  ctx.dispose();

  return new Response(html);
}
```

## API Reference

### `createStore<T>(initialState: T, context?: LatticeContext)`

Creates a reactive store with signal-based state.

### `createLattice()`

Creates an isolated context for signals, computeds, and effects.

### `partial<T>(key: keyof T, value: T[keyof T])`

Helper for creating single-property updates.

### Store Methods

- `store.state` - Signal-wrapped state properties
- `store.set(updates)` - Batch update state
- `store.getContext()` - Get the underlying context
- `store.dispose()` - Clean up all resources

### Context Methods

- `context.signal(value)` - Create a signal in this context
- `context.computed(fn)` - Create a computed value
- `context.effect(fn)` - Create an effect
- `context.batch(fn)` - Batch updates
- `context.dispose()` - Clean up context

## License

MIT
