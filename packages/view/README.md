# @rimitive/view

Reactive UI primitives for rimitive. Elements, lists, conditionals, portals.

## Quick Start

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createElModule } from '@rimitive/view/el';
import { MountModule } from '@rimitive/view/deps/mount';

const adapter = createDOMAdapter();

const { signal, computed, el, mount } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  MountModule
);

const count = signal(0);

const App = () =>
  el('div')(
    el('p')(computed(() => `Count: ${count()}`)),
    el('button').props({ onclick: () => count((c) => c + 1) })('Increment')
  );

document.body.appendChild(mount(App()).element!);
```

---

## el

Creates element specs. Specs are inert blueprints—they become real DOM when mounted.

```typescript
el('div')('Hello');

el('button').props({ disabled: true, className: 'btn' })('Click');

// Reactive props
el('p').props({ textContent: computed(() => `Count: ${count()}`) })();

// Lifecycle via ref
el('input')
  .ref((elem) => elem.focus())
  .ref((elem) => {
    elem.addEventListener('input', handler);
    return () => elem.removeEventListener('input', handler);
  })();
```

Partial application for reusable tags:

```typescript
const div = el('div');
const button = el('button');

const App = () =>
  div.props({ className: 'app' })(
    button.props({ onclick: handleClick })('Submit')
  );
```

---

## map

Reactive lists with keyed reconciliation.

```typescript
import { createMapModule } from '@rimitive/view/map';

const { signal, el, map } = compose(...modules, createMapModule(adapter));

const items = signal([
  { id: 1, text: 'First' },
  { id: 2, text: 'Second' },
]);

// Key function required for objects
map(
  items,
  (item) => item.id,
  (item) => el('li')(computed(() => item().text))
);

// Primitives don't need keys
const tags = signal(['a', 'b', 'c']);
map(tags, (tag) => el('span')(tag));
```

The render callback receives a reactive `item`—call `item()` to read.

---

## match

Conditional rendering. Switches views when the reactive value changes.

```typescript
import { createMatchModule } from '@rimitive/view/match';

const { signal, match } = compose(...modules, createMatchModule(adapter));

const tab = signal<'home' | 'settings'>('home');

match(tab, (current) => (current === 'home' ? HomePage() : SettingsPage()));

// Conditional show/hide
const showModal = signal(false);
match(showModal, (show) => (show ? Modal() : null));
```

---

## portal

Renders content into a different DOM location.

```typescript
import { createPortalModule } from '@rimitive/view/portal';

const { portal } = compose(...modules, createPortalModule(adapter));

// Portal to document.body (default)
portal()(el('div').props({ className: 'modal' })('Content'));

// Portal to specific element
portal(() => document.getElementById('tooltips'))(Tooltip());
```

---

## load

Async loading boundaries.

```typescript
import { LoadModule } from '@rimitive/view/load';

const { load, el } = compose(...modules, LoadModule);

load({
  loader: async () => {
    const data = await fetch('/api/data').then((r) => r.json());
    return DataView(data);
  },
  loading: () => el('div')('Loading...'),
  error: (err) => el('div')(`Error: ${err.message}`),
});
```

---

## mount

Creates real DOM from specs.

```typescript
import { MountModule } from '@rimitive/view/deps/mount';

const { mount } = compose(...modules, MountModule);

const ref = mount(App());
document.body.appendChild(ref.element!);

// Cleanup
ref.dispose?.();
```

---

## Adapters

View modules take an adapter for renderer-agnostic operation.

```typescript
// DOM (browser)
import { createDOMAdapter } from '@rimitive/view/adapters/dom';

// Test (no DOM required)
import { createTestAdapter } from '@rimitive/view/adapters/test';

// Custom (Canvas, WebGL, etc.)
import type { Adapter } from '@rimitive/view/adapter';

const myAdapter: Adapter<MyConfig> = {
  createNode: (tag, props) => { ... },
  setAttribute: (element, key, value) => { ... },
  insertBefore: (parent, node, anchor) => { ... },
  removeChild: (parent, node) => { ... },
  createTextNode: (text) => { ... },
  createComment: (text) => { ... },
};
```

---

## Specs vs Elements

**Specs** are data—inert descriptions of what to render:

```typescript
const spec = el('div')('Hello'); // Just data, no DOM
```

**Elements** are created when specs are mounted:

```typescript
const ref = mount(spec); // Now it's real DOM
document.body.appendChild(ref.element!);
```

This separation enables SSR, testing without a DOM, and composition before mounting.
