# @rimitive/signals

Reactive primitives for rimitive. Signals, computeds, effects, and friends.

**[Full documentation](https://rimitive.dev/signals/)**

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

const count = signal(0);
count(count() + 1); // read then write

const items = signal<string[]>([]);
items([...items(), 'new']); // spread and append
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

| Strategy           | Use case                                                      |
| ------------------ | ------------------------------------------------------------- |
| `mt(fn)`           | Batch multiple synchronous signal updates into one effect run |
| `raf(fn)`          | DOM measurements, canvas rendering, animations                |
| `debounce(ms, fn)` | User input, search boxes, expensive operations                |

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

---

## iter

Reactive collection with O(1) mutations. Like a signal, but for lists.

```typescript
import { IterModule } from '@rimitive/signals/extend';

const { signal, computed, effect, iter } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  IterModule
);

type Todo = { id: number; text: string };

const todos = iter<Todo>(
  (todo) => todo.id,
  [
    { id: 1, text: 'Buy milk' },
    { id: 2, text: 'Walk dog' },
  ]
);
```

### Reading (tracks dependency)

```typescript
// Callable - returns array
todos(); // [{ id: 1, ... }, { id: 2, ... }]

// Iterable - works with for...of
for (const todo of todos) {
  console.log(todo.text);
}

// In computed/effect - auto-tracks
const count = computed(() => todos().length);
effect(() => console.log('Todos:', [...todos]));
```

### O(1) Mutations

```typescript
todos.append({ id: 3, text: 'New todo' });
todos.prepend({ id: 0, text: 'First' });
todos.insertAfter(refTodo, newTodo);
todos.insertBefore(refTodo, newTodo);
todos.remove(todo); // by item
todos.remove(1); // by key
todos.update({ id: 1, text: 'Updated' });
todos.clear();
```

### Bulk Replace (with reconciliation)

```typescript
// Callable with array - reconciles efficiently
todos([
  { id: 2, text: 'Walk dog' },
  { id: 3, text: 'New item' },
]);
// Removes id:1, adds id:3, reorders - minimal operations
```

### Lookups

```typescript
todos.get(1); // { id: 1, text: '...' } | undefined
todos.has(1); // true
todos.size; // 2 (reactive)
todos.peek(); // [...] without tracking (like signal.peek())
```

### Why iter?

| Operation   | `signal<T[]>` | `iter<T>` |
| ----------- | ------------- | --------- |
| Append      | O(n) copy     | O(1)      |
| Remove      | O(n) copy     | O(1)      |
| Update item | O(n) copy     | O(1)      |
| Read all    | O(1)          | O(n)      |

Use `iter` when you frequently mutate lists. Use `signal<T[]>` for small, rarely-changed arrays.
