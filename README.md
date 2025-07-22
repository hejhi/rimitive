# Lattice

[![CI](https://github.com/henryivry/lattice/actions/workflows/ci.yml/badge.svg)](https://github.com/henryivry/lattice/actions)

Fine-grained reactivity for JavaScript. Run anywhere.

```typescript
import { signal, computed, effect } from '@lattice/signals';

const name = signal('World');
const greeting = computed(() => `Hello, ${name.value}!`);

effect(() => console.log(greeting.value)); // Hello, World!
name.value = 'Lattice'; // Hello, Lattice!
```

## Why Lattice?

Modern frameworks bundle state management with rendering. This creates lock-in and limits portability. Your business logic doesn't always care whether it runs in React, Vue, or a Node.js server.

Lattice provides reactive primitives that work everywhere:

- **Performant** - Meets or exceeds Preact signal performance in benchmark
- **Framework agnostic** - Use the same reactive core across React, Vue, Solid, or vanilla JS
- **Truly portable** - Share stateful logic between frontend, backend, and edge workers
- **Minimal overhead** - tiny packages, no virtual DOM, direct property access
- **Concurrent and SSR-safe** - React 18+ concurrent-ready and cross-framework SSR
- **100% Typesafe** - Built from the ground up with typescript
- **Nothing new** - Selects patterns from the best of the best, with no novel concepts

## Packages

### [@lattice/signals](/packages/signals)

Core reactive primitives - context-aware signals, computed values, effects.

```typescript
const count = signal(0);
const doubled = computed(() => count.value * 2);
```

### [@lattice/lattice](/packages/lattice)

Generic extension composition framework for building extensible libraries.

```typescript
import { createContext } from '@lattice/lattice';
import { signalExtension } from '@lattice/signals';

const context = createContext(signalExtension);
const count = context.signal(0);
```

### State Management with Lattice

Combine signals with the extension framework for state management:

```typescript
import { createContext } from '@lattice/lattice';
import { coreExtensions } from '@lattice/signals';

const context = createContext(...coreExtensions);

// fully typed!
const todos = context.signal([]);
const filter = context.signal('all');
```

## Installation

```bash
# Core primitives only
npm install @lattice/signals

# For building extensible libraries
npm install @lattice/lattice
```

## The Gap Lattice Fills

**Current landscape:**

- **React**: Hooks couple state to components and re-renders
- **MobX**: Class-based, decorators, larger bundle size
- **Zustand**: React-specific, no computed values
- **Valtio**: Proxy-based, magic that can surprise
- **Jotai/Recoil**: Atom-based, React-only

**What's missing:** Simple, portable reactivity that works like you expect - just values that update when they should.

## Design Principles

1. **No magic** - Direct property access, no proxies or transforms
2. **Explicit dependencies** - Tracked automatically but predictably
3. **Synchronous by default** - No async complexity unless you add it
4. **Tree-shakeable** - Import only what you use

## Quick Examples

### Cross-Framework Store

```typescript
// store.ts - works anywhere
export function createTodoStore() {
  const store = createStore({
    todos: [],
    filter: 'all'
  });

  return {
    store,
    addTodo: (text) => {
      const todo = { id: Date.now(), text, done: false };
      store.state.todos.value = [...store.state.todos.value, todo];
    }
  };
}

// react-app.tsx
function App() {
  const todos = useLattice(createTodoStore);
  return <TodoList todos={todos} />;
}

// vue-app.vue
const todos = createTodoStore();
watchEffect(() => console.log(todos.store.state.todos.value));

// server.ts
const todos = createTodoStore();
todos.addTodo('Server-side todo');
```

### Derived State

```typescript
const items = signal([
  { name: 'Apple', price: 1.5, quantity: 3 },
  { name: 'Banana', price: 0.75, quantity: 5 },
]);

const subtotal = computed(() =>
  items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

const tax = computed(() => subtotal.value * 0.08);
const total = computed(() => subtotal.value + tax.value);

effect(() => {
  console.log(`Total: $${total.value.toFixed(2)}`);
});
```

### Fine-Grained Updates

```typescript
const state = signal({ user: { name: 'Alice', prefs: { theme: 'dark' } } });

// Only react to theme changes
const themeWatcher = state.select((s) => s.user.prefs.theme);
themeWatcher.subscribe(() => updateTheme());

// Update nested without losing reactivity
state.set('user', { ...state.value.user, name: 'Bob' });
```

## Performance

Lattice uses several techniques for lightning performance (see our [benchmarks](/packages/signals)):

- **Lazy evaluation** - Computed values only run when accessed
- **Minimal allocations** - Reuses dependency tracking nodes
- **No diffing** - Direct value comparison, no virtual DOM
- **Batched updates** - Multiple changes trigger one update

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT
