# @lattice/view

Reactive DOM primitives for Lattice applications.

## Quick Start

```typescript
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { MountModule } from '@lattice/view/deps/mount';

const adapter = createDOMAdapter();
const svc = compose(
  SignalModule, ComputedModule, EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  MountModule
);

const { signal, computed, el, map, mount } = svc;

const count = signal(0);

const App = () =>
  el('div')(
    el('p')(computed(() => `Count: ${count()}`)),
    el('button').props({ onclick: () => count(c => c + 1) })('Increment')
  );

document.body.appendChild(mount(App()).element!);
```

---

## Primitives

### el

Creates element specs. Specs are inert blueprints — they don't become real DOM until mounted.

```typescript
// Basic element with children
el('div')('Hello')

// With props
el('button').props({ disabled: true, className: 'btn' })('Click')

// Reactive props
el('p').props({ textContent: computed(() => `Count: ${count()}`) })()

// With lifecycle callbacks
el('input')
  .ref((elem) => elem.focus())
  .ref((elem) => {
    elem.addEventListener('input', handler);
    return () => elem.removeEventListener('input', handler);
  })()
```

#### Partial Application

Pre-bind commonly used tags:

```typescript
const div = el('div');
const button = el('button');

const App = () =>
  div.props({ className: 'app' })(
    button.props({ onclick: handleClick })('Submit')
  );
```

### map

Renders reactive lists. Items are keyed for efficient reconciliation.

```typescript
const items = signal([
  { id: 1, text: 'First' },
  { id: 2, text: 'Second' },
]);

// With key function (required for objects)
map(items, (item) => item.id, (item) =>
  el('li')(computed(() => item().text))
)

// Without key function (for primitives)
const tags = signal(['a', 'b', 'c']);
map(tags, (tag) => el('span')(tag))
```

The render callback receives a reactive `item` — call `item()` to read. When the source array updates, existing elements update in place; no recreation needed.

### match

Switches between views based on a reactive value.

```typescript
const tab = signal<'home' | 'settings'>('home');

match(tab, (current) =>
  current === 'home' ? HomePage() : SettingsPage()
)

// With null for conditional hide
const showModal = signal(false);

match(showModal, (show) =>
  show ? Modal() : null
)
```

When the reactive value changes, the current element is disposed and replaced.

### portal

Renders content into a different DOM location while maintaining cleanup scope.

```typescript
// Portal to document.body (default)
portal()(
  el('div').props({ className: 'modal-backdrop' })(
    el('div').props({ className: 'modal' })('Content')
  )
)

// Portal to specific element
portal(() => document.getElementById('tooltips'))(
  Tooltip()
)

// Portal to signal ref
const container = signal<HTMLElement | null>(null);
portal(container)(content)
```

### load

Async loading boundaries with loading and error states.

```typescript
import { LoadModule } from '@lattice/view/load';

const svc = compose(...modules, LoadModule);
const { load } = svc;

load({
  loader: async () => {
    const data = await fetch('/api/data').then(r => r.json());
    return DataView(data);
  },
  loading: () => el('div')('Loading...'),
  error: (err) => el('div')(`Error: ${err.message}`),
})
```

---

## Event Handling

Use the `on()` helper for type-safe event binding:

```typescript
import { OnModule } from '@lattice/view/deps/addEventListener';

const svc = compose(...modules, OnModule);
const { el, on } = svc;

el('button')
  .ref(on('click', (e) => console.log('clicked!')))
  ('Click me')

el('input')
  .ref(on('input', (e) => value(e.target.value)))
  ()
```

---

## Mount

`mount()` creates real DOM from specs:

```typescript
import { MountModule } from '@lattice/view/deps/mount';

const svc = compose(...modules, MountModule);
const { mount } = svc;

const ref = mount(App());

document.body.appendChild(ref.element!);

// Later, to cleanup
ref.dispose?.();
```

---

## Adapters

View modules take an adapter — that's how Lattice stays renderer-agnostic.

### DOM Adapter

```typescript
import { createDOMAdapter } from '@lattice/view/adapters/dom';

const adapter = createDOMAdapter();
const svc = compose(
  SignalModule, ComputedModule, EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
);
```

### Test Adapter

For unit testing without a DOM:

```typescript
import { createTestAdapter } from '@lattice/view/adapters/test';

const adapter = createTestAdapter();
const svc = compose(...modules, createElModule(adapter));
```

### Custom Adapters

Implement the `Adapter` interface for Canvas, WebGL, or other renderers:

```typescript
import type { Adapter } from '@lattice/view/adapter';

const myAdapter: Adapter<MyConfig> = {
  createNode: (tag, props) => { ... },
  setProperty: (element, key, value) => { ... },
  insertBefore: (parent, node, anchor) => { ... },
  removeChild: (parent, node) => { ... },
  createTextNode: (text) => { ... },
  createComment: (text) => { ... },
};
```

---

## Import Guide

| Use Case | Import |
|----------|--------|
| DOM adapter | `import { createDOMAdapter } from '@lattice/view/adapters/dom'` |
| El module | `import { createElModule } from '@lattice/view/el'` |
| Map module | `import { createMapModule } from '@lattice/view/map'` |
| Match module | `import { createMatchModule } from '@lattice/view/match'` |
| Portal module | `import { createPortalModule } from '@lattice/view/portal'` |
| Mount | `import { MountModule } from '@lattice/view/deps/mount'` |
| Event helper | `import { OnModule } from '@lattice/view/deps/addEventListener'` |
| Types only | `import type { RefSpec, NodeRef } from '@lattice/view'` |

---

## Types

```typescript
import type {
  RefSpec,           // Element spec (blueprint)
  NodeRef,           // Created element reference
  ElementRef,        // Single element ref
  FragmentRef,       // Fragment ref (map, match result)
  Adapter,           // Renderer adapter interface
  AdapterConfig,     // Adapter configuration type
} from '@lattice/view';
```

---

## Specs vs Elements

**Specs** are data — inert descriptions of what to render:

```typescript
const spec = el('div')('Hello');  // Just data, no DOM
```

**Elements** are created when specs are mounted:

```typescript
const ref = mount(spec);          // Now it's real DOM
document.body.appendChild(ref.element!);
```

This separation enables:
- **SSR** — Same specs render to HTML strings on server
- **Testing** — Inspect specs without a DOM
- **Composition** — Combine specs before mounting

---

## License

MIT
