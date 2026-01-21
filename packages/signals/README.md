# @rimitive/signals

Reactive primitives for rimitive. Signals, computeds, effects, and friends.

## Quick Start

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';

const { signal, computed, effect } = compose(
  SignalModule,
  ComputedModule,
  EffectModule
);

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => console.log('Count:', count()));
// logs: "Count: 0"

count(5);
// logs: "Count: 5"
```

---

## signal

Reactive state. Read with `sig()`, write with `sig(value)`.

```typescript
const name = signal('Alice');

name(); // 'Alice'
name('Bob');
name(); // 'Bob'
name.peek(); // read without tracking
```

Updater functions work too:

```typescript
const count = signal(0);
count((c) => c + 1);

const items = signal<string[]>([]);
items((arr) => [...arr, 'new']);
```

---

## computed

Derived values. Lazy, cached, auto-tracks dependencies.

```typescript
const firstName = signal('Ada');
const lastName = signal('Lovelace');

const fullName = computed(() => `${firstName()} ${lastName()}`);

fullName(); // 'Ada Lovelace'
lastName('Byron');
fullName(); // 'Ada Byron'
```

---

## effect

Side effects when dependencies change. **Synchronous**—runs immediately, not next tick.

```typescript
const user = signal({ name: 'Alice', online: false });

effect(() => {
  console.log(`${user().name} is ${user().online ? 'online' : 'offline'}`);
});
// logs: "Alice is offline"

user({ ...user(), online: true });
// logs: "Alice is online"
```

Returns a dispose function:

```typescript
const dispose = effect(() => console.log(count()));
dispose(); // stops tracking
```

### Flush Strategies

By default, effects run synchronously—the moment a dependency changes, the effect runs. Sometimes you want to defer execution. That's what flush strategies are for.

```typescript
import { mt, raf, debounce } from '@rimitive/signals/extend';

// Run on next microtask (coalesces rapid updates)
effect(mt(() => console.log(count())));

// Run on requestAnimationFrame (ideal for DOM reads/writes)
effect(raf(() => updateCanvas(data())));

// Run after 300ms of no changes
effect(debounce(300, () => search(query())));
```

| Strategy | Use case |
|----------|----------|
| `mt(fn)` | Batch multiple synchronous signal updates into one effect run |
| `raf(fn)` | DOM measurements, canvas rendering, animations |
| `debounce(ms, fn)` | User input, search boxes, expensive operations |

Without a strategy, effects are synchronous. Wrap your effect function in a strategy to control timing.

---

## batch

Group updates into a single notification.

```typescript
import { BatchModule } from '@rimitive/signals/extend';

const { signal, effect, batch } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule
);

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

---

## subscribe

Subscribe without creating a reactive context.

```typescript
import { SubscribeModule } from '@rimitive/signals/extend';

const { signal, subscribe } = compose(SignalModule, SubscribeModule);

const count = signal(0);
const unsubscribe = subscribe(count, (value) => {
  console.log('Count changed to:', value);
});

count(1); // logs: "Count changed to: 1"
unsubscribe();
```

---

## untrack

Read signals without tracking.

```typescript
import { UntrackModule } from '@rimitive/signals/extend';

const { signal, computed, untrack } = compose(
  SignalModule,
  ComputedModule,
  UntrackModule
);

const a = signal(1);
const b = signal(2);

// Only tracks `a`, not `b`
const result = computed(() => a() + untrack(() => b()));

result(); // 3
b(10);
result(); // still 3 (b not tracked)
a(5);
result(); // 15 (recomputes, reads current b)
```
