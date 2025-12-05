# @lattice/react

React bindings for Lattice signals. Use reactive primitives in React components with automatic subscription management.

## Quick Start

```tsx
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { SignalProvider, useSignal, useSubscribe } from '@lattice/react';

// Create signals service (once, at app root)
const svc = createSignalsSvc();

function App() {
  return (
    <SignalProvider svc={svc}>
      <Counter />
    </SignalProvider>
  );
}

function Counter() {
  // Local signal with useState-like API
  const [count, setCount] = useSignal(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}
```

## Hooks

### `useSubscribe(signal)`

Subscribe to any reactive value (signal or computed). Re-renders when the value changes.

```tsx
import { useSubscribe } from '@lattice/react';

function Display({ count }: { count: Readable<number> }) {
  const value = useSubscribe(count);
  return <span>{value}</span>;
}
```

Uses `useSyncExternalStore` for React 18 concurrent mode compatibility.

### `useSignal(initialValue)`

Create a component-scoped signal with a `useState`-like API.

```tsx
import { useSignal } from '@lattice/react';

function Form() {
  const [name, setName] = useSignal('');
  const [email, setEmail] = useSignal('');

  return (
    <form>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
    </form>
  );
}
```

The setter accepts either a value or an updater function:

```tsx
setCount(5);              // Set to 5
setCount(prev => prev + 1); // Increment
```

### `useSelector(signal, selector)`

Subscribe to a derived value. Only re-renders when the selected value changes.

```tsx
import { useSelector } from '@lattice/react';

function TodoCount({ todos }: { todos: Readable<Todo[]> }) {
  // Only re-renders when count changes, not when todo content changes
  const count = useSelector(todos, t => t.length);
  return <span>{count} items</span>;
}

function FirstTodo({ todos }: { todos: Readable<Todo[]> }) {
  const first = useSelector(todos, t => t[0]?.title ?? 'None');
  return <span>First: {first}</span>;
}
```

### `createHook(behavior)`

Create a React hook from a portable behavior. Behaviors are framework-agnostic logic that can be used in both Lattice views and React.

```tsx
import { createHook, useSubscribe } from '@lattice/react';

// Define a portable behavior
const counter = (svc) => (initialCount = 0) => {
  const count = svc.signal(initialCount);
  const doubled = svc.computed(() => count() * 2);

  return {
    count,
    doubled,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
  };
};

// Create React hook
const useCounter = createHook(counter);

function Counter() {
  const c = useCounter(10);
  const count = useSubscribe(c.count);
  const doubled = useSubscribe(c.doubled);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={c.increment}>+</button>
      <button onClick={c.decrement}>-</button>
    </div>
  );
}
```

Arguments are captured once on mount. For reactive options, pass signals:

```tsx
const timer = (svc) => ({ interval }: { interval: Readable<number> }) => {
  const elapsed = svc.signal(0);

  svc.effect(() => {
    const ms = interval(); // Reactive - effect re-runs when interval changes
    const id = setInterval(() => elapsed(e => e + 1), ms);
    return () => clearInterval(id);
  });

  return { elapsed };
};
```

## Context

### `SignalProvider`

Provides the signals service to descendant components.

```tsx
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { SignalProvider } from '@lattice/react';

const svc = createSignalsSvc();

function App() {
  return (
    <SignalProvider svc={svc}>
      <MyApp />
    </SignalProvider>
  );
}
```

The provider automatically disposes the service when unmounted.

### `useSignalSvc()`

Access the signals service from context (typically for advanced use cases).

```tsx
import { useSignalSvc } from '@lattice/react';

function MyComponent() {
  const svc = useSignalSvc();

  // Create signals directly
  const data = useRef(svc.signal(null));

  // Set up effects
  useEffect(() => {
    return svc.effect(() => {
      console.log('Data changed:', data.current());
    });
  }, [svc]);

  // ...
}
```

### `useLatticeContext(...extensions)`

Create a Lattice context with custom service definitions, scoped to component lifecycle.

```tsx
import { useLatticeContext } from '@lattice/react';
import { Signal, Computed, Effect } from '@lattice/signals';

function App() {
  const ctx = useLatticeContext(
    Signal().create(helpers),
    Computed().create(helpers),
    Effect().create(helpers)
  );

  // ctx has signal, computed, effect methods
  // Automatically disposed on unmount
}
```

## Portable Behaviors

The main value proposition: write logic once, use everywhere.

```typescript
// behaviors/counter.ts
export const counter = (svc) => (initial = 0) => {
  const count = svc.signal(initial);
  const doubled = svc.computed(() => count() * 2);

  return {
    count,
    doubled,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    reset: () => count(initial),
  };
};
```

**In Lattice view:**

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';
import { counter } from './behaviors/counter';

const { use, el, t } = createDOMSvc();
const useCounter = use(counter);

const Counter = () => {
  const c = useCounter(10);
  return el('button').props({ onclick: c.increment })(t`Count: ${c.count}`);
};
```

**In React:**

```tsx
import { createHook, useSubscribe } from '@lattice/react';
import { counter } from './behaviors/counter';

const useCounter = createHook(counter);

function Counter() {
  const c = useCounter(10);
  const count = useSubscribe(c.count);
  return <button onClick={c.increment}>Count: {count}</button>;
}
```

Same behavior, same logic, different renderers.

## Types

```typescript
// Signal value extractor
type SignalValue<S> = S extends Readable<infer T> ? T : never;

// Setter function (like useState)
type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;

// Reactive types from @lattice/signals
type Readable<T> = { (): T };
type Writable<T> = Readable<T> & { (value: T): void };

// Provider props
type SignalProviderProps = {
  svc: SignalSvc;
  children: ReactNode;
};

// Minimal service interface
type SignalSvc = {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
  dispose: () => void;
};
```

## Installation

```bash
pnpm add @lattice/react @lattice/signals react
```

## License

MIT
