# @lattice/signals

Performant reactive primitives that just work. No boilerplate or magic strings, just values that update when they should.

```typescript
import { signal, computed, effect } from '@lattice/signals';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log(`count: ${count.value}, doubled: ${doubled.value}`);
});

count.value++; // logs: count: 1, doubled: 2
```

## Installation

```bash
npm install @lattice/signals
```

## Features

- **Concurrent-safe** - Built-in context isolation for React 18+ concurrent features
- **SSR-ready** - Full server-side rendering support with request isolation
- **Minimal overhead** - Direct property access, no getters/setters
- **Lazy evaluation** - Computed values only run when accessed
- **Fine-grained updates** - Transform and subscribe to derived values
- **TypeScript-first** - Full type safety with inference

## Core Concepts

### Signals

Signals hold reactive values. When you change a signal, anything that depends on it updates automatically.

```typescript
const name = signal('Alice');
const age = signal(25);

// Read values
console.log(name.value); // 'Alice'

// Write values
name.value = 'Bob';
age.value++;
```

### Computed

Computed values derive from other reactive values. They update lazily and cache their results.

```typescript
const items = signal([
  { name: 'Apples', price: 2.5, quantity: 3 },
  { name: 'Oranges', price: 3, quantity: 2 },
]);

const total = computed(() =>
  items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

console.log(total.value); // 13.5
```

### Effects

Effects run side effects when their dependencies change.

```typescript
const user = signal({ name: 'Alice', role: 'admin' });

// Runs immediately and whenever user changes
const cleanup = effect(() => {
  document.title = `${user.value.name} - Dashboard`;

  // Optional: return cleanup function
  return () => console.log('Cleaning up');
});

// Stop the effect
cleanup();
```

### Subscriptions

For more control, subscribe to specific changes:

```typescript
const todos = signal([
  { id: 1, text: 'Learn signals', done: false },
  { id: 2, text: 'Build app', done: false },
]);

// Basic subscription
const unsub = todos.subscribe(() => {
  console.log('Todos changed!');
});
```

## Patterns

### Transforming Values (Select Pattern)

Use computed values to create derived subscribables with transformations:

```typescript
const state = signal({ 
  user: { name: 'Alice', age: 30 },
  preferences: { theme: 'dark' }
});

// Create a derived value that only updates when name changes
const userName = computed(() => state.value.user.name);

// Subscribe to just the name changes
subscribe(userName, () => {
  console.log('User name changed to:', userName.value);
});

// This triggers the subscription
state.value = { ...state.value, user: { name: 'Bob', age: 30 } };

// This doesn't trigger it (name didn't change)
state.value = { ...state.value, user: { name: 'Bob', age: 31 } };

// Compose transformations
const upperName = computed(() => userName.value.toUpperCase());
const nameLength = computed(() => userName.value.length);
```

This pattern replaces the old `select()` method with a more composable approach using `computed()`.

### Nested Updates

Signals provide helpers for updating nested data immutably:

```typescript
const state = signal({
  user: { name: 'Alice', settings: { theme: 'dark' } },
  todos: [],
});

// Update nested property
state.set('user', { ...state.value.user, name: 'Bob' });

// Patch nested object
state.patch('user', { name: 'Bob' }); // Only updates name
```

### Batching

Group multiple updates to run effects only once:

```typescript
const firstName = signal('Alice');
const lastName = signal('Smith');
let fullNameCount = 0;

effect(() => {
  fullNameCount++;
  console.log(`${firstName.value} ${lastName.value}`);
});

// Without batching: effect runs twice
firstName.value = 'Bob';
lastName.value = 'Jones';

// With batching: effect runs once
batch(() => {
  firstName.value = 'Alice';
  lastName.value = 'Smith';
});
```

### Conditional Dependencies

Computed values only track dependencies that are actually accessed:

```typescript
const showDetails = signal(false);
const basicInfo = signal({ name: 'Product' });
const detailedInfo = signal({ description: 'Long text...' });

const display = computed(() => {
  // Always depends on showDetails and basicInfo
  const text = basicInfo.value.name;

  if (showDetails.value) {
    // Only depends on detailedInfo when showDetails is true
    return `${text}: ${detailedInfo.value.description}`;
  }

  return text;
});
```

## Coming from Other Libraries

### From React

If you're used to React hooks:

- `signal()` is like `useState()` but works outside components
- `computed()` is like `useMemo()` but with automatic dependencies
- `effect()` is like `useEffect()` but with automatic dependencies

### From Vue

If you're used to Vue's reactivity:

- `signal()` is like `ref()`
- `computed()` works the same
- `effect()` is like `watchEffect()`

### From MobX

If you're used to MobX:

- `signal()` is like `observable.box()`
- `computed()` works the same
- `effect()` is like `autorun()`

## API Reference

### `signal<T>(initialValue: T)`

Creates a reactive value container.

### `computed<T>(fn: () => T)`

Creates a computed value that updates when dependencies change.

### `effect(fn: () => void | (() => void))`

Runs a side effect and re-runs when dependencies change. Returns a cleanup function.

### `batch<T>(fn: () => T)`

Batches signal updates. Effects only run once after all updates complete.

### Signal Methods

- `signal.value` - Get or set the current value
- `signal.peek()` - Read value without tracking dependencies
- `signal.subscribe(listener)` - Listen for changes
- `signal.set(key, value)` - Update object property or array element
- `signal.patch(key, partial)` - Partially update nested objects

## Server-Side Rendering (SSR)

For SSR, wrap each request in its own context to prevent state leakage between requests:

```typescript
import { withContext } from '@lattice/signals';

// Next.js app directory
export default withContext(async function Page() {
  // Each request gets isolated signal context
  const user = signal(await getUser());
  return <Dashboard user={user} />;
});

// Express/Node.js
app.get('*', (req, res) => {
  withContext(() => {
    const html = renderToString(<App />);
    res.send(html);
  });
});
```

### React Server Components

Signals work great for server-side computations or effects:

```typescript
// app/stats/page.tsx
export default withContext(async function StatsPage() {
  const orders = signal(await db.orders.count());
  const revenue = signal(await db.orders.sum('total'));

  // Computed values run on the server
  const avgOrder = computed(() => revenue.value / orders.value);

  return (
    <div>
      <p>Orders: {orders.value}</p>
      <p>Average: ${avgOrder.value.toFixed(2)}</p>
    </div>
  );
});
```

## License

MIT
