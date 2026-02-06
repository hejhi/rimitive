# @rimitive/view

View layer tooling for rimitive. Elements, lists, conditionals, portals.

**[Full documentation](https://rimitive.dev/view/)**

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
    el('button').props({ onclick: () => count(count() + 1) })('Increment')
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

## lazy

Code-splitting with dynamic imports. Wraps an import into a stand-in that passes through when loaded, or creates an async boundary while pending.

```typescript
import { LazyModule } from '@rimitive/view/lazy';

const { lazy, match, el } = compose(...modules, MatchModule.with({ adapter }), LazyModule);

// Resolve to a RefSpec-producing function in .then()
const LazyChart = lazy(() =>
  import('./Chart').then(m => m.Chart(svc))
);

// Use like any other component — async boundary is transparent
el('div')(LazyChart(data));

// Before hydration, ensure all chunks are loaded
await lazy.preloadAll();
```

On the server, bundlers resolve imports synchronously so `lazy()` always hits the fast path (direct call-through, no overhead). On the client, a `signal` + `match` boundary renders nothing until the chunk arrives, then swaps in the real content.

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

## shadow

Renders children into a shadow root attached to the parent element—creating an isolated DOM subtree with encapsulated styles.

```typescript
import { createShadowModule } from '@rimitive/view/shadow';

const { shadow, el } = compose(...modules, createShadowModule(adapter));

// Basic shadow DOM
el('div').props({ className: 'host' })(
  shadow({ mode: 'open' })(
    el('p')('Inside shadow DOM')
  )
)

// With scoped styles
const css = `.content { color: blue; }`;
el('div')(
  shadow({ mode: 'open', styles: css })(
    el('span').props({ className: 'content' })('Styled text')
  )
)

// Access shadow root imperatively via .ref()
el('div')(
  shadow({ mode: 'open' })
    .ref((shadowRoot) => {
      const editor = createEditor({ root: shadowRoot });
      return () => editor.dispose(); // cleanup
    })
    (el('div')('Content'))
)
```

Options:

- `mode`: `'open'` (accessible via `element.shadowRoot`) or `'closed'` (not accessible)
- `styles`: CSS string or array of strings to inject into the shadow root
- `delegatesFocus`: Whether to delegate focus to the shadow tree

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
