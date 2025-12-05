# @lattice/view

Declarative view primitives for Lattice. Build reactive UIs with an adapter system that targets DOM, Canvas, SSR, or custom renderers.

## Quick Start

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';

const { el, signal, computed, map, match, when, on, t, mount } = createDOMSvc();

const count = signal(0);

const Counter = () =>
  el('div')(
    el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
    el('button').ref(on('click', () => count(count() + 1)))('Increment')
  );

mount(Counter(), document.body);
```

## Primitives

### `el(tag)`

Element builder with fluent API for props and lifecycle.

```typescript
// Basic element with children
el('div')(
  el('h1')('Hello'),
  el('p')('World')
)

// Props - static or reactive
el('input').props({
  type: 'text',
  value: computed(() => name()),           // reactive
  placeholder: 'Enter name',               // static
  oninput: (e) => name(e.target.value),   // event handler
})()

// Lifecycle callbacks with .ref()
el('canvas').ref((canvas) => {
  const ctx = canvas.getContext('2d');
  // ... setup
  return () => { /* cleanup */ };
})()

// Chaining
el('button')
  .props({ className: 'primary' })
  .ref(on('click', handleClick))
  ('Submit')
```

### `map(items, keyFn, render)`

Efficient list rendering with keyed reconciliation.

```typescript
const todos = signal([
  { id: 1, text: 'Learn Lattice' },
  { id: 2, text: 'Build app' },
]);

map(
  todos,
  (todo) => todo.id,
  (todo) => el('li')(todo().text)
)
```

The render callback receives a reactive `todo` signal—call `todo()` to read the current value. When items update, map pushes new values into existing signals rather than recreating elements.

For primitives (strings, numbers), omit the key function:

```typescript
map(['a', 'b', 'c'], (item) => el('li')(item()))
```

### `match(reactive, matcher)`

Switch between different elements based on a reactive value.

```typescript
const currentTab = signal<'home' | 'settings'>('home');

match(currentTab, (tab) =>
  tab === 'home' ? HomePage() : SettingsPage()
)
```

When the value changes, match disposes the current element and creates a new one from the matcher function.

### `when(condition, ...children)`

Conditional rendering—show children when truthy, hide when falsy.

```typescript
const showDetails = signal(false);

when(showDetails,
  el('div')('Details content'),
  el('div')('More details')
)
```

More efficient than `match` for simple show/hide since it doesn't recreate parents.

### `portal(target)(child)`

Render content outside the normal DOM hierarchy.

```typescript
// Default: renders to document.body
portal()(
  el('div').props({ className: 'modal' })('Modal content')
)

// Custom target
const modalRoot = signal<HTMLElement | null>(null);
portal(modalRoot)(tooltipContent)

// Getter target
portal(() => document.getElementById('modal-root'))(content)
```

The portal's lifecycle is tied to its logical parent—cleanup happens automatically.

## DOM Helpers

### `on(event, handler)`

Event listener with automatic batching and cleanup.

```typescript
el('button').ref(on('click', (e) => {
  count(count() + 1);
  name('clicked');
  // Both updates batched into single render
}))('Click')
```

### `t` (template literal)

Reactive text interpolation.

```typescript
const name = signal('World');
const count = signal(0);

el('p')(t`Hello ${name}! Count: ${count}`)
// Updates automatically when name or count change
```

### `use(behavior)`

Bind portable behaviors to the view service.

```typescript
// Define a portable behavior
const counter = (svc) => (initial = 0) => {
  const count = svc.signal(initial);
  return {
    count,
    increment: () => count(count() + 1),
  };
};

// Use in view
const { use, el, t } = createDOMSvc();
const useCounter = use(counter);

const c = useCounter(10);
el('button').ref(on('click', c.increment))(t`Count: ${c.count}`)
```

## Adapter System

The view layer separates reactivity from rendering through adapters. The same primitives work with any tree-based target.

### Built-in Adapters

**DOM Adapter** (browser):
```typescript
import { createDOMAdapter } from '@lattice/view/adapters/dom';

const adapter = createDOMAdapter();
```

**Test Adapter** (testing/SSR):
```typescript
import { createTestAdapter } from '@lattice/view/adapters/test';

const adapter = createTestAdapter();
```

### Custom Adapters

Implement the `Adapter` interface:

```typescript
import type { Adapter, AdapterConfig } from '@lattice/view/adapter';

type CanvasConfig = AdapterConfig & {
  props: { rect: RectProps; circle: CircleProps; text: TextProps };
  elements: { rect: RectNode; circle: CircleNode; text: TextNode };
  events: {};
  baseElement: CanvasNode;
};

const canvasAdapter: Adapter<CanvasConfig> = {
  createNode(type, props) { /* ... */ },
  setProperty(node, key, value) { /* ... */ },
  appendChild(parent, child) { /* ... */ },
  removeChild(parent, child) { /* ... */ },
  insertBefore(parent, child, ref) { /* ... */ },

  // Optional lifecycle hooks
  beforeCreate(type, props) { /* ... */ },
  onCreate(ref, parent) { /* ... */ },
  beforeAttach(ref, parent, nextSibling) { /* ... */ },
  onAttach(ref, parent) { /* ... */ },
  beforeDestroy(ref, parent) { /* ... */ },
  onDestroy(ref, parent) { /* ... */ },
};
```

### Sharing Signals Across Adapters

For apps with multiple render targets (DOM + Canvas):

```typescript
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createDOMViewSvc } from '@lattice/view/presets/dom';

// Share signals between adapters
const signals = createSignalsSvc();
const dom = createDOMViewSvc(signals);
const canvas = createCanvasViewSvc(signals);

// Same signal works everywhere
const { signal } = signals;
const position = signal({ x: 0, y: 0 });
```

## Architecture

### RefSpec Pattern

View primitives return `RefSpec` objects—blueprints that can be instantiated multiple times:

```typescript
const Button = (label: string) =>
  el('button').props({ className: 'btn' })(label);

// RefSpec can be created multiple times
const btn1 = Button('Save').create();
const btn2 = Button('Cancel').create();
```

### Fragment System

`map`, `match`, `when`, and `portal` return fragments—logical containers that don't create DOM elements but manage their children's lifecycle:

```typescript
// Fragment owns its children's lifecycle
const list = map(items, (i) => i.id, (item) => el('li')(item().name));

// When list disposes, all children clean up automatically
```

### Scoped Effects

View primitives create scoped effects tied to element lifecycle:

```typescript
el('div').ref((element) => {
  // This effect runs when element is created
  const dispose = effect(() => {
    console.log(count()); // Tracks count
  });

  // Cleanup runs when element is removed
  return dispose;
})()
```

## Modular Imports

Each primitive is available as a separate export:

```typescript
import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/map';
import { Match } from '@lattice/view/match';
import { When } from '@lattice/view/when';
import { Portal } from '@lattice/view/portal';
```

These are service factories. For most cases, use the preset:

```typescript
import { createDOMSvc } from '@lattice/view/presets/dom';
```

## Types

```typescript
// Element reference
type ElementRef<TElement> = {
  status: typeof STATUS_ELEMENT;
  element: TElement;
  parent: ElementRef<TElement> | null;
  prev: LinkedNode<TElement> | null;
  next: LinkedNode<TElement> | null;
  firstChild: LinkedNode<TElement> | null;
  lastChild: LinkedNode<TElement> | null;
};

// Blueprint for creating elements
type RefSpec<TElement> = {
  status: typeof STATUS_REF_SPEC;
  create<TExt>(svc?, extensions?, parentContext?): NodeRef<TElement> & TExt;
};

// Lifecycle callback
type LifecycleCallback<TElement> = (element: TElement) => void | (() => void);

// Valid children for el()
type ElRefSpecChild =
  | string | number | boolean | null
  | RefSpec<unknown>
  | Reactive<unknown>
  | FragmentRef<unknown>;
```

## Installation

```bash
pnpm add @lattice/view @lattice/signals
```

## License

MIT
