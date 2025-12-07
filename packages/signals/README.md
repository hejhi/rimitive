# @lattice/signals

Reactive primitives for Lattice. A push-pull signal implementation inspired by [Vue 3.4](https://github.com/vuejs/core), [Preact Signals](https://preactjs.com/blog/signal-boosting/), and [alien-signals](https://github.com/stackblitz/alien-signals).

## Quick Start

```typescript
import { createSignals } from '@lattice/signals/presets/core';

const { signal, computed, effect, batch, subscribe } = createSignals();

// Signals are callable functions
const count = signal(0);
count(); // read → 0
count(1); // write
count(); // read → 1
count.peek(); // read without tracking

// Computeds are lazy - only recompute when read and stale
const doubled = computed(() => count() * 2);
doubled(); // computes: 2
doubled(); // cached: 2
count(5); // marks doubled stale (doesn't recompute)
doubled(); // recomputes: 10

// Effects run immediately and re-run when dependencies change
const dispose = effect(() => {
  console.log(`Count is ${count()}`);
});
count(1); // logs: "Count is 1"
dispose(); // cleanup

// Batch multiple updates into one effect run
batch(() => {
  count(1);
  count(2);
  count(3);
}); // effect runs once with final value
```

## Primitives

### `signal<T>(initialValue: T)`

Reactive container for a value. Reading tracks dependencies; writing notifies subscribers.

```typescript
const name = signal('Alice');

name(); // read: 'Alice'
name('Bob'); // write, notifies subscribers
name.peek(); // read without tracking: 'Bob'
```

### `computed<T>(fn: () => T)`

Derived value that recomputes lazily when dependencies change.

```typescript
const firstName = signal('Alice');
const lastName = signal('Smith');

const fullName = computed(() => `${firstName()} ${lastName()}`);

fullName(); // 'Alice Smith'
lastName('Jones');
fullName(); // 'Alice Jones' (recomputed)
fullName(); // 'Alice Jones' (cached)
```

Computeds support both:

- **Diamond dependencies**: Multiple paths to the same source
- **Dynamic dependencies**: Dependencies that change based on conditions

### `effect(fn: () => void | (() => void))`

Side effect that runs when dependencies change. Return a cleanup function for resource management.

```typescript
const count = signal(0);

const dispose = effect(() => {
  const value = count();
  console.log(`Count: ${value}`);

  // Optional cleanup runs before next execution
  return () => console.log(`Cleaning up ${value}`);
});

count(1); // logs: "Cleaning up 0", "Count: 1"
dispose(); // logs: "Cleaning up 1", stops tracking
```

### `batch<T>(fn: () => T)`

Group multiple signal writes into a single update cycle.

```typescript
const a = signal(0);
const b = signal(0);

effect(() => console.log(a() + b()));

batch(() => {
  a(1);
  b(2);
}); // logs once: 3 (not twice)
```

### `subscribe<T>(source: () => T, callback: (value: T) => void)`

React to specific signals without tracking callback dependencies.

```typescript
const count = signal(0);
const multiplier = signal(2);

// Only re-runs when count changes, not multiplier
const unsubscribe = subscribe(
  () => count(),
  (value) => console.log(value * multiplier())
);

count(5); // logs: 10
multiplier(3); // no log (multiplier not tracked)
count(5); // no log (value unchanged)
count(6); // logs: 18
unsubscribe();
```

### `untrack<T>(fn: () => T)`

Read reactive values without creating dependencies.

```typescript
const a = signal(1);
const b = signal(2);

effect(() => {
  const aVal = a(); // tracked
  const bVal = untrack(() => b()); // not tracked
  console.log(aVal + bVal);
});

a(10); // re-runs effect
b(20); // does not re-run effect
```

## Architecture

### Push-Pull Algorithm

The implementation uses a two-phase update model:

**Push Phase** (on signal write):

1. Mark all dependent computeds as "possibly stale" (PENDING)
2. Schedule effects for execution
3. No recomputation happens yet

**Pull Phase** (on computed read):

1. Check if any upstream dependencies actually changed
2. Recompute only if necessary
3. Cache the result

This avoids cascading recomputes in diamond dependency graphs:

```
     A
    / \
   B   C
    \ /
     D
```

When A changes, B, C, and D are marked pending. When D is read, it pulls from B and C, which pull from A. Each node recomputes at most once.

### Graph Structure

The dependency graph uses a doubly-linked list structure for O(1) edge operations:

- **Producers** (signals, computeds): Track subscribers
- **Consumers** (computeds, effects): Track dependencies
- **Edges**: Connect producers to consumers with version tracking

Version tracking enables efficient dependency pruning when a computed's dependencies change dynamically.

## Usage Patterns

### Most Users: Presets

For most applications, use the preset—it bundles everything and handles wiring:

```typescript
import { createSignals } from '@lattice/signals/presets/core';

const { signal, computed, effect, batch, subscribe } = createSignals();
```

This is the recommended path. No configuration needed.

### Power Users: Custom Composition

If you need fine-grained control (custom deps, shared signals across adapters, instrumentation), import primitives directly and compose:

```typescript
import { compose } from '@lattice/lattice';
import { Signal, Computed, Effect, deps } from '@lattice/signals';

// Create shared deps (dependency graph, scheduler, etc.)
const deps = deps();

// Compose only what you need
const svc = compose(
  { signal: Signal(), computed: Computed(), effect: Effect() },
  deps
);
```

**When to use this pattern:**

- Sharing signals between multiple render targets (DOM + Canvas)
- Adding instrumentation/debugging
- Excluding unused primitives for smaller bundles
- Creating custom reactive primitives

### Library Authors: defineService

Create new primitives using the same pattern Lattice uses internally:

```typescript
import { defineService } from '@lattice/lattice';

export const MyPrimitive = defineService(
  (deps: { signal: SignalFactory }) => (options?: MyOptions) => ({
    name: 'myPrimitive',
    impl: createImpl(deps, options),
  })
);
```

## Import Paths

| Path                            | What You Get               | Use Case             |
| ------------------------------- | -------------------------- | -------------------- |
| `@lattice/signals/presets/core` | `createSignals()`          | Most users           |
| `@lattice/signals`              | `Signal`, `Computed`, etc. | Custom composition   |
| `@lattice/signals/signal`       | `Signal` only              | Maximum tree-shaking |

## Types

```typescript
// Callable function types
type Readable<T> = { (): T };
type Writable<T> = Readable<T> & { (value: T): void };
type SignalFunction<T> = Writable<T> & { peek(): T };
type ComputedFunction<T> = { (): T; peek(): T };
```

## Installation

```bash
pnpm add @lattice/signals
```

## License

MIT
