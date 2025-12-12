# @lattice/signals

Reactive primitives for Lattice applications.

## Quick Start

```typescript
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';

const { signal, computed, effect } = compose(SignalModule, ComputedModule, EffectModule);

// Reactive state
const count = signal(0);

// Derived values
const doubled = computed(() => count() * 2);

// Side effects
effect(() => console.log('Count:', count()));
// logs: "Count: 0"

count(5);
// logs: "Count: 5"
```

---

## Primitives

### signal

Holds reactive state. Read with `sig()`, write with `sig(value)`.

```typescript
const name = signal('Alice');

name();        // read: 'Alice'
name('Bob');   // write
name();        // read: 'Bob'
name.peek();   // read without tracking: 'Bob'
```

Signals accept updater functions:

```typescript
const count = signal(0);
count(c => c + 1);  // increment based on previous value

const items = signal<string[]>([]);
items(arr => [...arr, 'new']);  // append to array
```

### computed

Derives values from other signals. Lazy and cached.

```typescript
const firstName = signal('Ada');
const lastName = signal('Lovelace');

const fullName = computed(() => `${firstName()} ${lastName()}`);

fullName();  // 'Ada Lovelace'

lastName('Byron');
fullName();  // 'Ada Byron'
```

Computeds only recompute when dependencies change. They track dependencies automatically during execution.

### effect

Runs side effects when dependencies change. **Synchronous** — effects execute immediately, not on the next tick.

```typescript
const user = signal({ name: 'Alice', online: false });

effect(() => {
  console.log(`${user().name} is ${user().online ? 'online' : 'offline'}`);
});
// logs: "Alice is offline"

user({ ...user(), online: true });
// logs: "Alice is online"
```

Effects return a dispose function:

```typescript
const dispose = effect(() => {
  console.log(count());
});

dispose();  // stops tracking, no more logs
```

### batch

Groups multiple updates into a single notification.

```typescript
import { BatchModule } from '@lattice/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule, BatchModule);
const { signal, effect, batch } = svc;

const a = signal(1);
const b = signal(2);

effect(() => console.log(a() + b()));
// logs: 3

batch(() => {
  a(10);
  b(20);
});
// logs: 30 (once, not twice)
```

### subscribe

Subscribe to a signal without creating a reactive context.

```typescript
import { SubscribeModule } from '@lattice/signals/extend';

const svc = compose(SignalModule, SubscribeModule);
const { signal, subscribe } = svc;

const count = signal(0);

const unsubscribe = subscribe(count, (value) => {
  console.log('Count changed to:', value);
});

count(1);  // logs: "Count changed to: 1"
unsubscribe();
```

### untrack

Read signals without creating dependencies.

```typescript
import { UntrackModule } from '@lattice/signals/extend';

const svc = compose(SignalModule, ComputedModule, EffectModule, UntrackModule);
const { signal, computed, untrack } = svc;

const a = signal(1);
const b = signal(2);

// Only tracks `a`, not `b`
const result = computed(() => a() + untrack(() => b()));

result();  // 3

b(10);
result();  // still 3 (b not tracked)

a(5);
result();  // 15 (recomputes, reads current b)
```

---

## Import Guide

| Use Case | Import |
|----------|--------|
| Modules for composition | `import { SignalModule, ComputedModule } from '@lattice/signals/extend'` |
| Types only | `import type { Readable, Writable, SignalFunction } from '@lattice/signals'` |

### Without a bundler

The `/extend` path re-exports from individual modules for discoverability. Bundlers tree-shake unused exports, but without a bundler each import triggers a separate network request. For bundler-free usage, import directly:

```typescript
import { SignalModule } from '@lattice/signals/signal';
import { ComputedModule } from '@lattice/signals/computed';
import { EffectModule } from '@lattice/signals/effect';
```

---

## Types

```typescript
import type { Readable, Writable, SignalFunction, ComputedFunction } from '@lattice/signals';

// Readable<T> - any value you can read (signal or computed)
function double(source: Readable<number>): Readable<number> {
  return computed(() => source() * 2);
}

// Writable<T> - a value you can read and write (signal)
function reset(target: Writable<number>): void {
  target(0);
}

// SignalFunction<T> - signal with peek()
const count: SignalFunction<number> = signal(0);
count.peek();  // read without tracking

// ComputedFunction<T> - computed with peek()
const doubled: ComputedFunction<number> = computed(() => count() * 2);
doubled.peek();  // read without tracking
```

---

## Patterns

### Derived Actions

Attach actions directly to a signal:

```typescript
const counter = ({ signal }: SignalsSvc) => (initial = 0) => {
  const count = signal(initial);

  return Object.assign(count, {
    increment: () => count(c => c + 1),
    decrement: () => count(c => c - 1),
    reset: () => count(initial),
  });
};

const count = svc(counter)(0);

count();           // 0
count.increment(); // 1
count.reset();     // 0
```

### Toggle

Boolean signal with helpers:

```typescript
const toggle = ({ signal }: SignalsSvc) => (initial = false) => {
  const value = signal(initial);

  return Object.assign(value, {
    on: () => value(true),
    off: () => value(false),
    toggle: () => value(v => !v),
  });
};

const isOpen = svc(toggle)(false);
isOpen.toggle();  // true
isOpen.off();     // false
```

### Computed Collections

Pre-compute common derived views:

```typescript
const todos = ({ signal, computed }: SignalsSvc) => () => {
  const items = signal<Todo[]>([]);

  const active = computed(() => items().filter(t => !t.done));
  const completed = computed(() => items().filter(t => t.done));
  const counts = computed(() => ({
    total: items().length,
    active: active().length,
    completed: completed().length,
  }));

  return { items, active, completed, counts };
};
```

---

## Advanced: Custom Wiring

For custom compositions, use the factory functions directly:

```typescript
import { createSignalFactory } from '@lattice/signals/extend';
import { createGraphEdges } from '@lattice/signals/extend';
import { createScheduler } from '@lattice/signals/extend';

// Wire dependencies manually
const graphEdges = createGraphEdges();
const scheduler = createScheduler(graphEdges);
const signal = createSignalFactory({
  graphEdges,
  propagate: scheduler.propagate,
});
```

This is useful when building instrumented variants or integrating with external systems.

---

## License

MIT
