# @lattice/view

Reactive DOM primitives for building UIs with push-pull FRP.

## Key Features

✅ **No Compilation** - Pure JavaScript/TypeScript, no JSX transform needed
✅ **No VDOM** - Direct DOM manipulation via reactive effects
✅ **No Keys** (usually) - Identity-based list tracking
✅ **Element-Scoped Reactivity** - Automatic cleanup when elements are removed
✅ **Fine-Grained Updates** - Only changed DOM nodes update

## Architecture

`@lattice/view` implements a **dual-graph architecture**:

```
┌─────────────────────────────┐
│   Signal Graph (State)      │
│   signals → computed        │
│            ↓ (observes)     │
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│   View Graph (DOM)          │
│   Elements with bindings    │
└─────────────────────────────┘
```

- **Signal graph** manages state and dependencies
- **View graph** contains actual DOM elements
- **Bindings** (via effects) connect signals to DOM updates

## Primitives

### `el(spec)` - Create reactive elements

Creates real DOM elements with automatic reactivity detection.

```ts
el(['tag', { props }, ...children])
```

**Features:**
- Auto-detects reactive values (signals/computeds) in props and children
- Creates effects automatically for reactive bindings
- Each element gets its own disposal scope
- Cleanup happens automatically when elements are removed

**Example:**
```ts
const count = signal(0);

el(['div',
  { className: 'counter' },

  // Reactive text
  el(['h1', computed(() => `Count: ${count()}`)]),

  // Reactive prop
  el(['button', {
    className: computed(() => count() > 10 ? 'high' : 'low'),
    onClick: () => count(count() + 1)
  }, 'Increment'])
])
```

### `elMap(itemsSignal, renderFn, keyFn?)` - Reactive lists

Renders lists efficiently without explicit keys.

```ts
elMap(
  itemsSignal,           // Signal<T[]>
  (itemSignal) => el,    // Render function receiving Signal<T>
  (item) => item.id      // Optional key extractor
)
```

**Features:**
- Uses object identity by default (no keys needed)
- Optional key function for immutable data patterns
- Efficient reconciliation (add/remove/move detection)
- Each item gets its own reactive scope

**Example:**
```ts
const todos = signal([
  { id: 1, text: 'Learn FRP', done: false },
  { id: 2, text: 'Build UI', done: false }
]);

el(['ul',
  elMap(
    todos,
    (todoSignal) => el(['li',
      {
        className: computed(() =>
          todoSignal().done ? 'done' : 'active'
        )
      },
      computed(() => todoSignal().text)
    ]),
    (todo) => todo.id  // Optional key
  )
])
```

## How It Works

### Component Functions Run Once

Unlike React or Vue, component functions execute **once**:

```ts
function Counter() {
  const count = signal(0);  // Runs once

  return el(['div',          // Runs once
    el(['button', {          // Runs once
      onClick: () => count(count() + 1)
    }]),

    // Only this computed re-runs when count changes
    computed(() => `Count: ${count()}`)
  ]);
}
```

### Element-Scoped Reactivity

Each element creates a disposal scope for its reactive subscriptions:

```ts
el(['div',
  // This computed is scoped to the div
  computed(() => state()),

  el(['span',
    // This computed is scoped to the span
    computed(() => otherState())
  ])
])
```

When an element is removed from the DOM, its scope automatically disposes all subscriptions.

### Identity-Based Lists

Lists track items by object reference, not explicit keys:

```ts
const item1 = { id: 1, text: 'A' };
const item2 = { id: 2, text: 'B' };

todos([item1, item2]);  // Initial render
todos([item1, item2]);  // No-op (same references)
todos([item2, item1]);  // Reorder DOM nodes
todos([item2]);         // Remove item1's DOM node
```

**Key insight:** If you maintain stable object references, you don't need explicit keys!

For immutable patterns, provide a key function:

```ts
elMap(
  todos,
  renderFn,
  (todo) => todo.id  // Use id as key
)
```

## Complete Example

```ts
import { createApi } from '@lattice/lattice';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createElFactory } from '@lattice/view/el';
import { createElMapFactory } from '@lattice/view/elMap';
import { createViewContext } from '@lattice/view/context';

// Create context (concurrency-safe)
function createContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withPropagate, dispose } = createScheduler({ detachAll });
  const pullPropagator = createPullPropagator({ track });
  const viewCtx = createViewContext();

  return {
    ctx,
    trackDependency,
    propagate: withPropagate(() => {}),
    track,
    dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    viewCtx,
  };
}

const context = createContext();

// Create API with view primitives
const api = createApi({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  el: (ctx) => createElFactory({ ctx: context.viewCtx, effect: ctx.effect }),
  elMap: (ctx) => createElMapFactory({
    ctx: context.viewCtx,
    signal: ctx.signal,
    effect: ctx.effect
  }),
}, context);

function TodoApp() {
  const { signal, computed, el, elMap } = api;

  const todos = signal([]);
  const filter = signal('all');

  const filteredTodos = computed(() => {
    const f = filter();
    return todos().filter(t =>
      f === 'all' ||
      (f === 'active' && !t.done) ||
      (f === 'done' && t.done)
    );
  });

  return el(['div',
    el(['input', {
      placeholder: 'Add todo...',
      onKeypress: (e) => {
        if (e.key === 'Enter') {
          todos([...todos(), {
            id: Date.now(),
            text: e.target.value,
            done: false
          }]);
          e.target.value = '';
        }
      }
    }]),

    el(['ul',
      elMap(
        filteredTodos,
        (todoSignal) => el(['li',
          el(['input', {
            type: 'checkbox',
            checked: computed(() => todoSignal().done),
            onChange: () => {
              const todo = todoSignal();
              todos(todos().map(t =>
                t.id === todo.id ? { ...t, done: !t.done } : t
              ));
            }
          }]),
          computed(() => todoSignal().text)
        ]),
        (todo) => todo.id
      )
    ])
  ]);
}

document.body.appendChild(TodoApp());
```

## Comparison

| Feature | @lattice/view | React | Vue | Solid |
|---------|---------------|-------|-----|-------|
| Compilation | ❌ No | ⚠️ Optional JSX | ⚠️ SFC | ⚠️ JSX |
| VDOM | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| Keys for lists | ⚠️ Optional | ✅ Required | ✅ Required | ✅ Required |
| Component re-runs | ❌ Once | ✅ Every render | ⚠️ Once (setup) | ❌ Once |
| Fine-grained reactivity | ✅ Yes | ❌ No | ⚠️ Composition | ✅ Yes |

## Implementation Details

### Concurrency-Safe Context

Like `@lattice/signals`, the view layer uses a context object (`ViewContext`) for tracking the current scope:

```ts
interface ViewContext {
  currentScope: Scope | null;
}
```

This ensures the view layer is concurrency-safe - multiple independent component trees can coexist without interference.

### Scope Management

Each element gets a `Scope` that tracks all reactive subscriptions created within it:

```ts
interface Scope {
  run<T>(fn: () => T): T;
  track(disposable: Disposable): void;
  dispose(): void;
}
```

When `computed()` or `effect()` is called within an element's scope, it's automatically tracked.

### List Reconciliation

`elMap` uses an efficient reconciliation algorithm:

1. **Removal Pass**: Dispose items no longer in the list
2. **Addition & Move Pass**: Create new items, reposition existing ones

The algorithm uses `Map<key, itemNode>` for O(1) lookup and `Set<key>` for existence checks.

### Memory Management

All reactive subscriptions (effects, computeds) must be disposed when no longer needed. This happens automatically:

- Elements dispose their scope when removed from DOM
- List items dispose their scope when removed from the list
- Scopes dispose all tracked subscriptions recursively

## Status

🚧 **Experimental** - API may change

This package explores reactive DOM rendering without VDOM. Feedback welcome!
