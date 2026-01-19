# @rimitive/react

React bindings for rimitive signals and behaviors.

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

## Hooks

### useSignal

Create a signal scoped to the component. Returns `[value, setter]` like useState.

```tsx
const [count, setCount] = useSignal(0);
setCount((prev) => prev + 1); // Updater functions work too
```

### useSubscribe

Subscribe to an external signal. Re-renders when the signal changes.

```tsx
function Display({ count }: { count: Readable<number> }) {
  const value = useSubscribe(count);
  return <span>{value}</span>;
}
```

### useSelector

Subscribe with a selector. Only re-renders when the selected value changes.

```tsx
function UserName({ user }: { user: Readable<User> }) {
  const name = useSelector(user, (u) => u.name);
  return <span>{name}</span>;
}
// Only re-renders when name changes, not email
```

### useSignalSvc

Access the signal service directly:

```tsx
const svc = useSignalSvc();
const count = useRef(svc.signal(0));
```

---

## SignalProvider

Wraps your app to provide signal context. Optionally pass a custom service:

```tsx
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule);

function App() {
  return (
    <SignalProvider svc={svc}>
      <YourApp />
    </SignalProvider>
  );
}
```

---

## createHook

Convert a portable rimitive behavior into a React hook:

```tsx
import { createHook, useSubscribe } from '@rimitive/react';

const counter = (svc) => (initial: number) => {
  const count = svc.signal(initial);
  return {
    count,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
  };
};

const useCounter = createHook(counter);

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

The behavior is instantiated once at mount (like useRef's initial value).

---

## React Bridge

Embed React components inside a Rimitive application. Useful for gradual migration or when you need React-specific libraries (like `@xyflow/react`).

### createReactBridge

Mount a React component with reactive props. Returns a ref callback for use with `el().ref()`.

```tsx
import { createReactBridge } from '@rimitive/react';
import { ReactFlow } from '@xyflow/react';

const GraphView = (svc) => {
  const { el, signal, effect } = svc;
  const nodes = signal([]);
  const edges = signal([]);

  // Create a ref that mounts ReactFlow with reactive props
  const graphRef = createReactBridge(effect, ReactFlow, () => ({
    nodes: nodes(),
    edges: edges(),
    onNodesChange: (changes) => { /* handle changes */ },
  }));

  return el('div').props({ className: 'graph-container' }).ref(graphRef)();
};
```

The component re-renders automatically when signal dependencies in `getProps` change.

### renderReact

Render arbitrary JSX with reactive dependencies. Lower-level alternative for more control.

```tsx
import { renderReact } from '@rimitive/react';

const StatusIndicator = (svc) => {
  const { el, signal, effect } = svc;
  const status = signal<'idle' | 'loading' | 'error'>('idle');

  const statusRef = renderReact(effect, () => (
    <Badge variant={status() === 'error' ? 'destructive' : 'default'}>
      {status()}
    </Badge>
  ));

  return el('div').ref(statusRef)();
};
```

Both functions handle cleanup automatically—the React component unmounts and the effect stops when the Rimitive element is removed.
