# Lattice

A collection of extensible, lightweight, and portable reactive libraries for building UI applications.

The signals implementation uses a push-pull algorithm similar to:

- [Vue 3.4's reactivity system](https://github.com/vuejs/core)
- [Preact Signals' double-linked-list approach](https://preactjs.com/blog/signal-boosting/)
- [alien-signals](https://github.com/nickmccurdy/alien-signals)

The view layer separates reactivity from rendering through an adapter system—the same component logic can target DOM, Canvas, SSR, or custom renderers.

Each package is independent. Use presets for convenience, or wire primitives manually.

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

### Computeds

Lazy evaluation—only recompute when read and dependencies changed:

```typescript
const doubled = computed(() => count() * 2);

doubled(); // computes: 2
doubled(); // cached: 2
count(5); // marks doubled as stale (doesn't recompute yet)
doubled(); // recomputes: 10
```

### Effects

```typescript
effect(() => {
  console.log(`Count is ${count()}`);
});

count(1); // logs: "Count is 1"
count(2); // logs: "Count is 2"
```

### Batching

```typescript
const { signal, effect, batch } = createSignalsApi();

const count = signal(0);
effect(() => console.log(count()));

batch(() => {
  count(1);
  count(2);
  count(3);
}); // effect runs once, logs: 3
```

## View Primitives

DOM primitives that work with signals:

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
| `@lattice/react`   | React bindings (useSignal, useSubscribe)                         |

## Installation

```bash
pnpm add @lattice/signals @lattice/view
```

For React integration:

```bash
pnpm add @lattice/react
```

## Portable Behaviors

Behaviors are curried functions: `(api) => (...args) => Result`

```typescript
// behaviors/counter.ts
import type { ReactiveAdapter } from '@lattice/signals/types';

export const counter =
  (api: ReactiveAdapter) =>
  (initialCount = 0) => {
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

Use in Lattice view with `use`:

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';
import { counter } from './behaviors/counter';

const { use, el, t } = createDOMSvc();
const useCounter = use(counter);

const c = useCounter(10);
el('button').props({ onclick: c.increment })(t`Count: ${c.count}`);
```

Use in React with `createHook`:

```typescript
import { createHook, useSubscribe } from '@lattice/react';
import { counter } from './behaviors/counter';

const useCounter = createHook(counter);

function Counter() {
  const c = useCounter(10);
  const count = useSubscribe(c.count);

  return <button onClick={c.increment}>Count: {count}</button>;
}
```

## Architecture

### Push-Pull Algorithm

- **Push**: When a signal changes, dependents are marked stale (not recomputed)
- **Pull**: Computeds recompute lazily when read

This avoids cascading recomputes.

### Package Structure

```
@lattice/signals ─── standalone reactivity
       │
       ├── @lattice/view ─── view primitives + adapters
       │        │
       │        ├── DOM adapter
       │        ├── Canvas adapter
       │        ├── SSR adapter
       │        └── custom adapters
       │
       ├── @lattice/react ─── React bindings
       │
       ├── @lattice/router ─── routing
       │
       └── @lattice/islands ─── SSR + hydration
```

`@lattice/lattice` provides a composition layer for wiring these together.

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
