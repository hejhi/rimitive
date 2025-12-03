# @lattice/view

Reactive DOM primitives for Lattice. A lightweight, SSR-compatible view layer built on fine-grained signals. Functional api.

## Features

- **Fine-grained reactivity** - Only what changes updates, no virtual DOM diffing
- **Performance** - Best-in-class performance—see the benchmarks
- **SSR compatible** - Works with `@lattice/islands` for server-side rendering and hydration
- **Portable** - Built-in (but not limited to) DOM and SSR adapters
- **Composable** - Built on `@lattice/lattice` extension system
- **Extensible** - Add custom primitives, instrument any function, compose your own service, down to the reactive model itself
- **Type-safe** - Full TypeScript support down to element-specific inference
- **Tiny** - <4kb with all batteries included, and fully tree-shakeable—use only what you need

## Installation

```bash
npm install @lattice/view @lattice/lattice
```

## Quick Start

```typescript
import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers } from '@lattice/view/presets/core';
import { createDOMRenderer } from '@lattice/view/renderers/dom';

// Create your reactive service
const signals = createSignalsApi();
const renderer = createDOMRenderer();
const view = composeFrom(
  defaultExtensions(),
  defaultHelpers(renderer, signals)
);

const { el, map, match, when } = view;
const { signal, computed } = signals;

// Create a component
const Counter = (initial = 0) => {
  const count = signal(initial);

  return el('div')(
    el('span')(computed(() => `Count: ${count()}`)),
    el('button').props({ onclick: () => count((c) => c + 1) })('+')
  );
};

// Mount to DOM
const ref = Counter(10).create({ ...signals, ...view });
document.body.appendChild(ref.element);

// Create reusable element factories
export const div = el('div');
export const button = el('button');
export const container = div.props({ className: 'container' });
```

## Inspiration

Lattice draws inspiration from several projects:

- **[Solid.js](https://www.solidjs.com/)** - Fine-grained reactivity without virtual DOM. Lattice shares the philosophy that reactive primitives should map directly to DOM updates, not through a diffing layer.
- **[Alien Signals](https://github.com/nickmccurdy/alien-signals)** - Performance-focused signal implementation. Lattice signals are optimized for minimal overhead and efficient dependency tracking.
- **[Preact Signals](https://preactjs.com/guide/v10/signals/)** - Demonstrated that signals can be framework-agnostic. Lattice extends this with the `@lattice/lattice` extension system for full composability.

### Why Lattice?

The JavaScript ecosystem has converged on signals as the reactive primitive of choice, but most implementations are coupled to specific frameworks. Lattice takes a different approach:

1. **Portable by design** - Write reactive behaviors once using `@lattice/signals`, use them in React, Vue, Svelte, or go framework-free with `@lattice/view`. Your logic isn't locked in.

2. **Performance without compromise** - No virtual DOM means updates are surgical. Benchmarks show Lattice outperforming Preact on both signals and view rendering.

3. **Extensible architecture** - The `@lattice/lattice` extension system lets you compose, instrument, and extend every primitive. Add devtools, logging, or custom behavior without forking.

4. **SSR as a first-class citizen** - `@lattice/islands` provides true islands architecture where static content ships zero JavaScript. Only interactive components hydrate.

5. **Honest abstractions** - The API surface is small and predictable. `el(tag).props(props)(children)` creates elements. `signal(value)` creates state. No magic, no hidden complexity.

6. **Zero compilation** - Unlike Solid (JSX transform), Svelte (compiler), or Vue (template compilation), Lattice works as pure TypeScript/JavaScript. No babel plugins, no build step required. Components are plain functions that return data structures—reactivity is entirely runtime.

### How Reactivity Works

Most frameworks either re-run components on every state change (React) or require compilation to create reactive bindings (Solid, Svelte, Vue). Lattice does neither:

```typescript
const Counter = () => {
  const count = signal(0); // Runs once when component is called

  return el('div')(
    computed(() => `Count: ${count()}`), // Explicit reactive boundary
    el('button').props({ onclick: () => count((c) => c + 1) })('+')
  );
};
// Component executes once, returns an inert blueprint (RefSpec)
// Only computed(), effect(), and element scopes track dependencies
```

Reactivity is explicit and predictable:

- **Component functions** - Run once, return blueprints. Not reactive.
- **`computed()`** - Creates a reactive derivation. Tracks dependencies.
- **`effect()`** - Creates a reactive side effect. Tracks dependencies.
- **Element scopes** - Props passed to `.props()` that are functions are automatically tracked.

You always know when dependency tracking happens because you explicitly opted into it.

Lattice is for developers who want the ergonomics of modern reactive frameworks with the performance of hand-written code and the flexibility to use it anywhere.

## Core API

### `el(tag).props(props)(children)`

Creates elements with reactive props and children. The `.props()` method is optional and chainable.

```typescript
// Basic element (no props)
el('div')('Hello');

// Element with props
el('div').props({ className: 'container' })('Hello');

// Reactive props
const isActive = signal(false);
el('button').props({
  className: computed(() => (isActive() ? 'active' : '')),
  onclick: () => isActive((v) => !v),
})('Toggle');

// Nested elements
el('div')(el('h1')('Title'), el('p')('Paragraph'));
```

**Props builder pattern:**

The `.props()` method returns a new element factory, enabling composition:

```typescript
// Create reusable element factories
const div = el('div');
const button = el('button');

// Build up styled variants
const card = div.props({ className: 'card' });
const blueCard = card.props((p) => ({ ...p, className: `${p.className} blue` }));

// Use them
card('Card content');
blueCard('Blue card content');
blueCard.props({ id: 'main' })('Specific blue card');
```

**Props support:**

- Static values: `{ className: 'foo' }`
- Reactive values: `{ className: computed(() => ...) }`
- Event handlers: `{ onclick: handler, oninput: e => ... }` (transparent DOM assignment)
- Type-safe DOM attributes: `{ 'data-id': '123', 'aria-label': 'Close' }`

**Event handling:**

For most cases, use event props directly - they're transparent DOM property assignment:

```typescript
el('button').props({ onclick: () => count((c) => c + 1) })('Increment');
el('input').props({ oninput: (e) => text(e.target.value) })();
```

For advanced cases requiring automatic batching (multiple signal updates) or explicit cleanup, use the `on()` helper with `.ref()`:

```typescript
el('button').ref(on('click', () => {
  // Multiple updates batched into one re-render
  count((c) => c + 1);
  lastClicked(Date.now());
}))('Increment');
```

### `map(items, keyFn, render)`

Efficient list rendering with keyed reconciliation.

```typescript
const todos = signal([
  { id: 1, text: 'Learn Lattice' },
  { id: 2, text: 'Build something' },
]);

el('ul')(
  map(todos, (todo) => todo.id, (todo) => el('li')(todo().text))
);
```

**Key function is required for objects** - ensures efficient updates when items change order or are removed. For primitives, the key function can be omitted:

```typescript
map(['a', 'b', 'c'], (item) => el('li')(item()));
```

### `match(reactive, matcher)`

Switches between different elements based on a reactive value. Disposes and recreates children when the value changes.

```typescript
const currentTab = signal<'home' | 'settings'>('home');

match(currentTab, (tab) => (tab === 'home' ? HomePage() : SettingsPage()));

// Return null to render nothing
match(isLoggedIn, (loggedIn) => (loggedIn ? UserPanel() : null));
```

Use `match` for polymorphic rendering where the value determines _what_ to render.

### `when(condition, ...children)`

Conditionally shows/hides children based on a truthy condition. More efficient than `match` for simple show/hide.

```typescript
const showDetails = signal(false);

when(showDetails,
  el('div').props({ className: 'details' })(el('p')('These are the details...'))
);
```

Use `when` for boolean show/hide. Use `match` when switching between different component types.

## Reactive Text

### Using `computed()`

Wrap reactive expressions in `computed()` for dynamic text:

```typescript
const count = signal(0);

el('div')(computed(() => `Count: ${count()}`));
```

### Using Template Literals

For cleaner syntax, use the `createText` helper:

```typescript
import { createText } from '@lattice/view/helpers/text';

const t = createText(computed);
const count = signal(0);
const doubled = computed(() => count() * 2);

el('div')(t`Count: ${count} (doubled: ${doubled})`);
```

Signals and computeds are automatically unwrapped in the template.

## Lifecycle Callbacks

Add lifecycle callbacks using the `.ref()` method on the element factory:

```typescript
el('input')
  .props({ type: 'text' })
  .ref((element) => {
    // Called when element is created (within reactive scope)
    element.focus();

    // Return cleanup function (optional)
    return () => {
      console.log('Element removed');
    };
  })();
```

Multiple callbacks can be passed to a single `.ref()` call:

```typescript
el('canvas')
  .ref(
    addEventListener('pointerdown', handleDown),
    addEventListener('pointermove', handleMove),
    addEventListener('pointerup', handleUp)
  )();
```

Lifecycle callbacks can be baked into reusable factories:

```typescript
const autoFocusInput = el('input')
  .props({ type: 'text' })
  .ref((el) => el.focus());

// Every instance auto-focuses
autoFocusInput();
autoFocusInput();
```

### `on()` Helper

The `on()` helper (created via `createAddEventListener`) provides automatic batching and cleanup. Use it when:

- Your handler updates multiple signals (batching prevents multiple re-renders)
- You need explicit `removeEventListener` cleanup
- You need `addEventListener` options like `{ passive: true, capture: true }`

```typescript
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const on = createAddEventListener(batch);

// Multiple handlers with options
el('canvas').ref(
  on('pointerdown', handleDown),
  on('pointermove', handleMove, { passive: true }),
  on('pointerup', handleUp)
)();

// Handler with multiple signal updates (auto-batched)
el('button').ref(on('click', () => {
  items([...items(), newItem]);
  selectedId(newItem.id);
  isEditing(true);
}))('Add');
```

For simple single-signal handlers, prefer props - they're simpler and more transparent:

```typescript
el('button').props({ onclick: () => count((c) => c + 1) })('Increment');
```

## Components

Components are just functions that return RefSpecs:

```typescript
// Simple component
const Button = (label: string, onclick: () => void) =>
  el('button').props({ onclick })(label);

// Component with state
const Counter = (initial = 0) => {
  const count = signal(initial);

  return el('div')(
    el('span')(computed(() => `${count()}`)),
    Button('+', () => count((c) => c + 1)),
    Button('-', () => count((c) => c - 1))
  );
};

// Usage
el('div')(Counter(10), Counter(20));
```

## Behaviors (Headless Components)

Separate logic from UI with the `use*` pattern:

```typescript
// behaviors/useCounter.ts
const useCounter = (initial = 0) => {
  const count = signal(initial);
  const doubled = computed(() => count() * 2);

  return {
    count,
    doubled,
    increment: () => count((c) => c + 1),
    decrement: () => count((c) => c - 1),
    reset: () => count(initial),
  };
};

// components/Counter.ts
const Counter = (initial = 0) => {
  const { count, doubled, increment, decrement } = useCounter(initial);

  return el('div')(
    computed(() => `${count()} (×2 = ${doubled()})`),
    el('button').props({ onclick: increment })('+'),
    el('button').props({ onclick: decrement })('-')
  );
};
```

Behaviors are portable - use them with Lattice, React, Vue, or any framework.

## Custom Renderers

Create adapters for any tree-based target:

```typescript
import type { Renderer, RendererConfig } from '@lattice/view/renderer';

interface MyConfig extends RendererConfig {
  props: {
    /* tag -> props mapping */
  };
  elements: {
    /* tag -> element type mapping */
  };
  events: {
    /* event name -> event type mapping */
  };
  baseElement: MyNodeType;
}

const myRenderer: Renderer<MyConfig> = {
  createNode: (type, props) => {
    /* ... */
  },
  setProperty: (node, key, value) => {
    /* ... */
  },
  appendChild: (parent, child) => {
    /* ... */
  },
  removeChild: (parent, child) => {
    /* ... */
  },
  insertBefore: (parent, child, reference) => {
    /* ... */
  },
};
```

See `@lattice/view/renderers/dom` for a complete example.

## SSR & Hydration

Use with `@lattice/islands` for server-side rendering:

```typescript
import { createIslandsApp } from '@lattice/islands';
import { island } from './service';

// Define an island (interactive component)
const Counter = island(
  'counter',
  ({ el, signal }) =>
    (props: { initial: number }) => {
      const count = signal(props.initial);
      return el('button').props({ onclick: () => count((c) => c + 1) })(
        computed(() => `Count: ${count()}`)
      );
    }
);

// Static content (no JS shipped to client)
const Header = () => el('header')(el('h1')('My App'));

// Compose them
const App = () =>
  el('div')(
    Header(), // Static - rendered as HTML only
    Counter({ initial: 0 }) // Island - hydrated on client
  );
```

## TypeScript

Full type inference for elements and props:

```typescript
// Props are inferred from tag name
el('input').props({
  type: 'text', // ✓ valid
  value: 'hello', // ✓ valid
  checked: true, // ✓ valid (though semantically for checkbox)
});

// Custom attributes work too
el('div').props({
  'data-testid': 'my-div',
  'aria-label': 'Description',
});
```

## API Reference

### Primitives

| Export  | Description                |
| ------- | -------------------------- |
| `el`    | Element builder            |
| `map`   | Keyed list rendering       |
| `match` | Reactive element switching |
| `when`  | Conditional rendering      |

### Helpers

| Export                   | Path                                     | Description                 |
| ------------------------ | ---------------------------------------- | --------------------------- |
| `createAddEventListener` | `@lattice/view/helpers/addEventListener` | Event listener with cleanup |
| `createText`             | `@lattice/view/helpers/text`             | Reactive template literals  |
| `createSpec`             | `@lattice/view/helpers`                  | Low-level RefSpec creation  |

### Renderers

| Export               | Path                           | Description          |
| -------------------- | ------------------------------ | -------------------- |
| `createDOMRenderer`  | `@lattice/view/renderers/dom`  | Browser DOM renderer |
| `createTestRenderer` | `@lattice/view/renderers/test` | Testing renderer     |

### Presets

| Export              | Path                         | Description              |
| ------------------- | ---------------------------- | ------------------------ |
| `defaultExtensions` | `@lattice/view/presets/core` | Standard view extensions |
| `defaultHelpers`    | `@lattice/view/presets/core` | Standard view helpers    |
| `createViewApi`     | `@lattice/view/presets/core` | Quick setup helper       |

## License

MIT
