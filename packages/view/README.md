# @lattice/view

Reactive DOM primitives for Lattice. A lightweight, SSR-compatible view layer built on fine-grained signals.

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

// Create your service
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
    el('button', { onclick: () => count((c) => c + 1) })('+')
  );
};

// Mount to DOM
const ref = Counter(10).create({ ...signals, ...view });
document.body.appendChild(ref.element);
```

## Core API

### `el(tag, props)(children)`

Creates elements with reactive props and children.

```typescript
// Basic element
el('div', { className: 'container' })('Hello');

// Reactive props
const isActive = signal(false);
el('button', {
  className: computed(() => (isActive() ? 'active' : '')),
  onclick: () => isActive((v) => !v),
})('Toggle');

// Nested elements
el('div')(el('h1')('Title'), el('p')('Paragraph'));
```

**Props support:**

- Static values: `{ className: 'foo' }`
- Reactive values: `{ className: computed(() => ...) }`
- Event handlers: `{ onclick: handler, oninput: e => ... }`
- Any DOM attribute: `{ 'data-id': '123', 'aria-label': 'Close' }`

### `map(items, keyFn)(render)`

Efficient list rendering with keyed reconciliation.

```typescript
const todos = signal([
  { id: 1, text: 'Learn Lattice' },
  { id: 2, text: 'Build something' },
]);

el('ul')(map(todos, (todo) => todo.id)((todo) => el('li')(todo.text)));
```

**Key function is required for objects** - ensures efficient updates when items change order or are removed.

### `match(reactive)(matcher)`

Switches between different elements based on a reactive value. Disposes and recreates children when the value changes.

```typescript
const currentTab = signal<'home' | 'settings'>('home');

match(currentTab)((tab) => (tab === 'home' ? HomePage() : SettingsPage()));

// Return null to render nothing
match(isLoggedIn)((loggedIn) => (loggedIn ? UserPanel() : null));
```

Use `match` for polymorphic rendering where the value determines _what_ to render.

### `when(condition)(children)`

Conditionally shows/hides children based on a truthy condition. More efficient than `match` for simple show/hide.

```typescript
const showDetails = signal(false);

when(showDetails)(
  el('div', { className: 'details' })(el('p')('These are the details...'))
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

Add lifecycle callbacks by calling the RefSpec with callback functions:

```typescript
el('input', { type: 'text' })()((element) => {
  // Called when element is created (within reactive scope)
  element.focus();

  // Return cleanup function (optional)
  return () => {
    console.log('Element removed');
  };
});
```

### `addEventListener` Helper

For event listeners that need cleanup:

```typescript
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const addEventListener = createAddEventListener(batch);

el('div')()(addEventListener('scroll', handleScroll, { passive: true }));
```

## Components

Components are just functions that return RefSpecs:

```typescript
// Simple component
const Button = (label: string, onclick: () => void) =>
  el('button', { onclick })(label);

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
    el('button', { onclick: increment })('+'),
    el('button', { onclick: decrement })('-')
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
      return el('button', { onclick: () => count((c) => c + 1) })(
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
el('input', {
  type: 'text', // ✓ valid
  value: 'hello', // ✓ valid
  checked: true, // ✓ valid (though semantically for checkbox)
});

// Custom attributes work too
el('div', {
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
