# Lattice

A collection of extensible, lightweight, and portable reactive libraries for building UI applications.

The signals implementation uses a push-pull algorithm similar to [Vue 3.4](https://github.com/vuejs/core), [Preact Signals](https://preactjs.com/blog/signal-boosting/), and [alien-signals](https://github.com/stackblitz/alien-signals). The view layer separates reactivity from rendering through an adapter system—the same component logic can target DOM, Canvas, SSR, or custom renderers.

## Quick Start

Most users only need presets—preconfigured bundles that wire everything together:

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';

const { el, signal, computed, effect, mount } = createDOMSvc();

const count = signal(0);

const App = () =>
  el('div')(
    el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
  );

mount(App(), document.body);
```

That's it. No configuration, no wiring, no ceremony.

## Concepts

Lattice is designed around **progressive disclosure of complexity**. Start simple, go deeper only when you need to.

### Layer 1: Presets (Most Users)

Presets are ready-to-use service bundles. Import, call, build:

| Preset | What you get |
|--------|--------------|
| `createSignalsSvc()` | Signals only: `signal`, `computed`, `effect`, `batch`, `subscribe` |
| `createDOMSvc()` | Signals + DOM views: everything above plus `el`, `map`, `match`, `on`, `mount` |
| `createIslandsServerApp()` | SSR with islands architecture |
| `createIslandsClientApp()` | Client hydration for islands |

```typescript
// Signals only
import { createSignalsSvc } from '@lattice/signals/presets/core';
const { signal, computed, effect } = createSignalsSvc();

// Full DOM app
import { createDOMSvc } from '@lattice/view/presets/dom';
const { el, signal, computed, effect, mount } = createDOMSvc();
```

**When to stay here**: Building apps with standard DOM rendering. This covers most use cases.

### Layer 2: Composition (Power Users)

Under presets, Lattice uses a service composition pattern. Each primitive (`Signal`, `Computed`, `Effect`, etc.) is a factory that requires shared helpers to function. `compose` wires them together:

```typescript
import { compose } from '@lattice/lattice';
import { Signal, Computed, Effect, createHelpers } from '@lattice/signals';

// Create shared helpers (dependency graph, scheduler, etc.)
const helpers = createHelpers();

// Compose only the primitives you need
const svc = compose(
  { signal: Signal(), computed: Computed(), effect: Effect() },
  helpers
);
```

**When to go here**: You need to share signals across multiple render targets (DOM + Canvas), add instrumentation, or exclude unused primitives for smaller bundles.

### Layer 3: Custom Services (Library Authors)

Create your own primitives using `defineService`. This is the pattern Lattice's own primitives use:

```typescript
import { defineService } from '@lattice/lattice';

// Define a service that requires specific helpers
export const MyPrimitive = defineService(
  (deps: { signal: SignalFactory; effect: EffectFactory }) =>
    (options?: MyOptions) => ({
      name: 'myPrimitive',
      impl: createMyPrimitive(deps, options),
    })
);
```

**When to go here**: Building reusable libraries, creating custom reactive primitives, or extending Lattice with new capabilities.

---

## Signals

Signals are callable functions that hold reactive values:

```typescript
const count = signal(0);

count();      // read → 0
count(1);     // write
count();      // read → 1
count.peek(); // read without tracking
```

**Computeds** are lazy—they only recompute when read and when dependencies have changed:

```typescript
const doubled = computed(() => count() * 2);

doubled(); // computes: 2
doubled(); // cached: 2
count(5);  // marks doubled as stale (doesn't recompute yet)
doubled(); // recomputes: 10
```

**Effects** run side effects when dependencies change:

```typescript
effect(() => {
  console.log(`Count is ${count()}`);
});

count(1); // logs: "Count is 1"
count(2); // logs: "Count is 2"
```

**Batching** groups multiple updates into a single effect run:

```typescript
batch(() => {
  count(1);
  count(2);
  count(3);
}); // effect runs once with final value: 3
```

## Views

### Element Builder

The `el` function creates elements with a fluent API:

```typescript
el('div')(
  el('h1')('Hello'),
  el('p')('World')
)

// With props (static or reactive)
el('input').props({
  type: 'text',
  value: computed(() => name()),  // reactive
  placeholder: 'Enter name',      // static
})()

// With lifecycle
el('canvas').ref((canvas) => {
  const ctx = canvas.getContext('2d');
  return () => { /* cleanup */ };
})()
```

### Reactive Props

Pass signals or computeds to make props reactive:

```typescript
const isActive = signal(false);
const className = computed(() => (isActive() ? 'active' : 'inactive'));

el('div').props({ className });
```

### List Rendering

```typescript
const items = signal([{ id: 1, name: 'Item 1' }]);

map(
  items,
  (item) => item.id,
  (item) => el('li')(item().name)
);
```

### Conditional Rendering

```typescript
const currentTab = signal<'home' | 'settings'>('home');

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

Behaviors are curried functions: `(svc) => (...args) => Result`

```typescript
export const counter =
  (svc: ReactiveSvc) =>
  (initialCount = 0) => {
    const count = svc.signal(initialCount);
    const doubled = svc.computed(() => count() * 2);

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

const { use, el, computed } = createDOMSvc();
const useCounter = use(counter);

const c = useCounter(10);
el('button').props({
  textContent: computed(() => `Count: ${c.count()}`),
  onclick: c.increment
})();
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

This avoids cascading recomputes in diamond dependency graphs.

### Package Structure

```
@lattice/lattice ─── composition layer (wires everything together)
       │
@lattice/signals ─── standalone reactivity
       │
       ├── @lattice/view ─── view primitives + adapters
       │        │
       │        ├── DOM adapter (browser)
       │        ├── SSR adapter (server)
       │        └── custom adapters
       │
       ├── @lattice/react ─── React bindings
       │
       ├── @lattice/router ─── client-side routing
       │
       └── @lattice/islands ─── SSR + hydration
```

### Import Paths

Each package offers multiple import paths:

| Path | Use Case |
|------|----------|
| `@lattice/signals/presets/core` | Most users—bundled service |
| `@lattice/signals` | Individual primitives for custom composition |
| `@lattice/view/presets/dom` | Most users—bundled DOM service |
| `@lattice/view` | Individual primitives for custom composition |

Presets are the happy path. Direct imports are for power users who need fine-grained control.

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
