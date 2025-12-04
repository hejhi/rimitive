# Lattice

A toolkit of fine-grained reactive libraries for building UI applications.

Choose the pieces you need—signals, view primitives, routing, SSR—and compose them however you want. Lattice separates **reactivity** from **rendering**, so the same behavior and UI attributes work across React, native DOM, Canvas, or any adapter you write.

Use presets to get started, or wire up primitives yourself for full control. Each library is independent and tree-shakeable.

## Core Concepts

### Signals Are Just Functions

```typescript
import { createSignalsApi } from '@lattice/signals/presets/core';

const { signal, computed, effect } = createSignalsApi();

const count = signal(0);

count(); // read → 0
count(1); // write
count(); // read → 1
count.peek(); // read without tracking
```

### Derived Values Are Lazy

Computeds only recompute when read AND when dependencies changed:

```typescript
const doubled = computed(() => count() * 2);

doubled(); // computes: 2
doubled(); // cached: 2
count(5); // marks doubled as stale (doesn't recompute yet)
doubled(); // recomputes: 10
```

### Effects Run Automatically

```typescript
effect(() => {
  console.log(`Count is ${count()}`);
});

count(1); // logs: "Count is 1"
count(2); // logs: "Count is 2"
```

### Batching Prevents Redundant Work

```typescript
const { signal, effect, batch } = createSignalsApi();

const count = signal(0);
effect(() => console.log(count()));

batch(() => {
  count(1);
  count(2);
  count(3);
}); // effect runs once with final value: 3
```

## View Primitives

Lattice includes declarative DOM primitives that integrate with signals:

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';

const { el, signal, computed, mount } = createDOMSvc();

const count = signal(0);

const label = computed(() => `Count: ${count()}`);

const Counter = () =>
  el('div')(
    el('p').props({ textContent: label }),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );

mount(Counter(), document.body);
```

### Reactive Props

Pass signals or computeds to make props reactive:

```typescript
const isActive = signal(false);
const className = computed(() => (isActive() ? 'active' : 'inactive'));

el('div').props({ className });
```

> **Note:** Any function passed where a reactive is expected will be treated as a reactive closure—it will be called inside an effect and re-run when its dependencies change. Prefer explicit `signal` or `computed` for clarity and performance.

### List Rendering

```typescript
const { el, map, signal } = createDOMSvc();

const items = signal([{ id: 1, name: 'Item 1' }]);

map(
  items,
  (item) => item.id,
  (item) => el('li')(item().name)
);
```

### Conditional Rendering

```typescript
const { el, match, signal } = createDOMSvc();

const currentTab = signal<'home' | 'settings'>('home');

// Reactively switch between elements
match(currentTab, (tab) =>
  tab === 'home' ? el('div')('Home content') : el('div')('Settings content')
);
```

## Packages

| Package            | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `@lattice/lattice` | Service composition layer                                        |
| `@lattice/signals` | Reactive primitives (signal, computed, effect, batch, subscribe) |
| `@lattice/view`    | Declarative view primitives with adapter system                  |
| `@lattice/router`  | Client-side routing                                              |
| `@lattice/islands` | SSR and hydration support                                        |
| `@lattice/react`   | React bindings (useSignal, useSubscribe, useComponent)           |

## Installation

```bash
pnpm add @lattice/signals @lattice/view
```

For React integration:

```bash
pnpm add @lattice/react
```

## Headless Components

Write portable logic that works across frameworks:

```typescript
// behaviors/createCounter.ts - framework agnostic
interface SignalAPI {
  signal: <T>(value: T) => { (): T; (v: T): void };
  computed: <T>(fn: () => T) => () => T;
}

export const createCounter = (api: SignalAPI, initialCount = 0) => {
  const count = api.signal(initialCount);
  const doubled = api.computed(() => count() * 2);

  return {
    count,
    doubled,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
  };
};
```

Use in React:

```typescript
import { useComponent, useSubscribe } from '@lattice/react';
import { createCounter } from './behaviors/createCounter';

function Counter() {
  const counter = useComponent(createCounter, 10); // api injected automatically
  const count = useSubscribe(counter.count);

  return <button onClick={counter.increment}>Count: {count}</button>;
}
```

Use in Lattice view:

```typescript
const { signal, computed, el, t } = createDOMSvc();
const counter = createCounter({ signal, computed }, 10);

el('button').props({ onclick: counter.increment })(t`Count: ${counter.count}`);
```

## Architecture

### Push-Pull Reactivity

Lattice uses a **push-pull algorithm**:

- **Push**: When a signal changes, dependents are marked stale (not recomputed)
- **Pull**: Computeds recompute lazily when read

This prevents cascading recomputes and ensures minimal work.

### Composable by Design

Each package is independent. Use signals alone, add view primitives, bring your own renderer:

```
@lattice/signals ─── standalone reactivity
       │
       ├── @lattice/view ─── view primitives + adapters
       │        │
       │        ├── DOM adapter
       │        ├── Canvas adapter
       │        ├── SSR adapter
       │        └── your own adapter
       │
       ├── @lattice/react ─── React bindings
       │
       ├── @lattice/router ─── routing
       │
       └── @lattice/islands ─── SSR + hydration
```

Use `@lattice/lattice` to compose these pieces (or anything else) into your own service API.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Full check (typecheck + test + lint)
pnpm check
```

## License

MIT
