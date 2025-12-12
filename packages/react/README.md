# @rimitive/react

React bindings for Rimitive signals and behaviors.

## Quick Start

```tsx
import { SignalProvider, useSignal, useSubscribe } from '@rimitive/react';

function Counter() {
  const [count, setCount] = useSignal(0);

  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>;
}

function App() {
  return (
    <SignalProvider>
      <Counter />
    </SignalProvider>
  );
}
```

---

## Core Hooks

### useSignal

Create a signal scoped to the component lifecycle. Returns `[value, setter]` like useState.

```tsx
function Counter() {
  const [count, setCount] = useSignal(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

Supports updater functions:

```tsx
const [count, setCount] = useSignal(0);
setCount((prev) => prev + 1);
```

### useSubscribe

Subscribe to an external signal. Re-renders when the signal changes.

```tsx
function Display({ count }: { count: Readable<number> }) {
  const value = useSubscribe(count);
  return <span>{value}</span>;
}
```

Use this when signals are passed as props or come from a shared context.

### useSelector

Subscribe with a selector. Only re-renders when the selected value changes.

```tsx
function UserName({ user }: { user: Readable<User> }) {
  const name = useSelector(user, (u) => u.name);
  return <span>{name}</span>;
}

// Only re-renders when name changes, not when email changes
```

Useful for avoiding unnecessary re-renders with complex objects:

```tsx
function TodoCount({ todos }: { todos: Readable<Todo[]> }) {
  const count = useSelector(todos, (list) => list.length);
  return <div>Total: {count}</div>;
}
```

---

## SignalProvider

Wraps your app to provide the signal service context:

```tsx
import { SignalProvider } from '@rimitive/react';

function App() {
  return (
    <SignalProvider>
      <YourApp />
    </SignalProvider>
  );
}
```

With a custom service:

```tsx
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule, BatchModule);

function App() {
  return (
    <SignalProvider svc={svc}>
      <YourApp />
    </SignalProvider>
  );
}
```

Access the service directly with `useSignalSvc()`:

```tsx
import { useSignalSvc } from '@rimitive/react';

function Component() {
  const svc = useSignalSvc();
  const count = useRef(svc.signal(0));
  // ...
}
```

---

## Portable Behaviors

### createHook

Convert a portable Rimitive behavior into a React hook:

```tsx
import { createHook, useSubscribe } from '@rimitive/react';

// Define a portable behavior
const counter = (svc) => (initial: number) => {
  const count = svc.signal(initial);
  return {
    count,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
  };
};

// Create a React hook from it
const useCounter = createHook(counter);

// Use in a component
function Counter() {
  const { count, increment, decrement } = useCounter(0);
  const value = useSubscribe(count);

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{value}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

The behavior is instantiated once when the component mounts. Arguments are captured at mount time (like useRef's initial value).

For reactive options, pass signals:

```tsx
const useTimer = createHook((svc) => (interval: Readable<number>) => {
  const elapsed = svc.signal(0);
  svc.effect(() => {
    const id = setInterval(() => elapsed((e) => e + 1), interval());
    return () => clearInterval(id);
  });
  return elapsed;
});
```

---

## Advanced: useRimitiveContext

Create a Rimitive context scoped to the component lifecycle:

```tsx
import { useRimitiveContext } from '@rimitive/react';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';

function App() {
  const svc = useRimitiveContext(SignalModule, ComputedModule, EffectModule);

  const count = useRef(svc.signal(0));
  const doubled = useRef(svc.computed(() => count.current() * 2));

  // Context is automatically disposed on unmount
  return <div>...</div>;
}
```

This is useful when you need full control over the service composition or want to use modules beyond the default signal/computed/effect.

---

## Patterns

### Shared State with Context

```tsx
import { createContext, useContext } from 'react';
import { useSubscribe, SignalProvider, useSignalSvc } from '@rimitive/react';
import type { Readable, Writable } from '@rimitive/react';

type AppState = {
  user: Writable<User | null>;
  theme: Writable<'light' | 'dark'>;
};

const AppContext = createContext<AppState | null>(null);

function AppProvider({ children }) {
  const svc = useSignalSvc();

  const state = useRef<AppState>({
    user: svc.signal(null),
    theme: svc.signal('light'),
  });

  return (
    <AppContext.Provider value={state.current}>{children}</AppContext.Provider>
  );
}

function useAppState() {
  const state = useContext(AppContext);
  if (!state) throw new Error('AppProvider not found');
  return state;
}

// Usage
function ThemeToggle() {
  const { theme } = useAppState();
  const current = useSubscribe(theme);

  return (
    <button onClick={() => theme(current === 'light' ? 'dark' : 'light')}>
      {current}
    </button>
  );
}
```

### Derived State

```tsx
function TodoStats({ todos }: { todos: Readable<Todo[]> }) {
  const svc = useSignalSvc();

  // Create derived signals once
  const stats = useRef(
    svc.computed(() => {
      const list = todos();
      return {
        total: list.length,
        completed: list.filter((t) => t.done).length,
        remaining: list.filter((t) => !t.done).length,
      };
    })
  );

  const { total, completed, remaining } = useSubscribe(stats.current);

  return (
    <div>
      {completed}/{total} done, {remaining} remaining
    </div>
  );
}
```

---

## Import Guide

| Use Case   | Import                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| Core hooks | `import { useSignal, useSubscribe, useSelector } from '@rimitive/react'`  |
| Provider   | `import { SignalProvider, useSignalSvc } from '@rimitive/react'`          |
| Behaviors  | `import { createHook } from '@rimitive/react'`                            |
| Advanced   | `import { useRimitiveContext } from '@rimitive/react'`                    |
| Types      | `import type { Readable, Writable, SignalSetter } from '@rimitive/react'` |

---

## Types

```typescript
import type { Readable, Writable, SignalSetter, SignalValue } from '@rimitive/react';

// Readable<T> - any signal you can read
// Writable<T> - a signal you can read and write

// SignalSetter<T> - the setter function from useSignal
type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;

// SignalValue<S> - extract the value type from a signal
type SignalValue<Readable<number>> = number;
```

---

## License

MIT
