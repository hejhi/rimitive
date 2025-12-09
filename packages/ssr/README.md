# @lattice/islands

Islands architecture for Lattice. Server-side render your app, hydrate only the interactive parts.

## Overview

Islands let you ship less JavaScript. Static content stays as HTML—no hydration overhead. Interactive components ("islands") ship their JavaScript and hydrate independently.

```
┌─────────────────────────────────────────────────┐
│  <header>Static nav</header>        (no JS)     │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Counter island                    (JS) │   │
│  │  [+] 0 [-]                              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  <article>Static content...</article>  (no JS) │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Comments island                   (JS) │   │
│  │  Loading comments...                    │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Quick Start

### Define an Island

```typescript
// islands/Counter.ts
import { island } from '@lattice/islands/server';

export const Counter = island(
  'counter',
  (svc) => ({ initialCount }: { initialCount: number }) => {
    const { el, signal, computed } = svc;
    const count = signal(initialCount);

    return el('div')(
      el('button').props({ onclick: () => count(count() - 1) })('-'),
      el('span')(computed(() => ` ${count()} `)),
      el('button').props({ onclick: () => count(count() + 1) })('+')
    );
  }
);
```

### Server: Render to HTML

```typescript
// server.ts
import { createIslandsServerApp } from '@lattice/islands/server';
import { Counter } from './islands/Counter';

const { el, render } = createIslandsServerApp();

const App = () =>
  el('html')(
    el('body')(
      el('h1')('My App'),
      Counter({ initialCount: 0 }),
      el('p')('Static content—no JavaScript!')
    )
  );

const { html, scripts } = render(App());

// Send to client:
// <html>...</html>
// <script>window.__islands = [...];</script>
// <script>window.__hydrate(...);</script>
```

### Client: Hydrate Islands

```typescript
// client.ts
import { createIslandsClientApp } from '@lattice/islands/client';
import { Counter } from './islands/Counter';

const { hydrate } = createIslandsClientApp();

// Register and hydrate all islands on the page
hydrate(Counter);
```

## How It Works

### Server-Side Rendering

1. **Render**: Components render to HTML using linkedom
2. **Collect**: Islands register themselves during render
3. **Mark**: Script tags mark island boundaries for hydration
4. **Output**: HTML + hydration scripts sent to client

```html
<!-- Server output -->
<div>
  <h1>My App</h1>
  <div><!-- Counter island content --></div>
  <script type="application/json" data-island="counter-0"></script>
  <p>Static content—no JavaScript!</p>
</div>
<script>window.__hydrate("counter-0", "counter", {"initialCount":0}, 1);</script>
```

### Client-Side Hydration

1. **Find**: Locate islands by script tag markers
2. **Match**: Look up component in registry by type
3. **Hydrate**: Walk existing DOM, attach event handlers
4. **Activate**: Enable reactive updates

On mismatch, falls back to client-side render automatically.

## API

### `island(id, factory)`

Mark a component as an island. The pre-configured `island` factory is exported from both `@lattice/islands/server` and `@lattice/islands/client`.

```typescript
import { island } from '@lattice/islands/server';

export const MyIsland = island(
  'my-island',           // Unique ID for registry lookup
  (svc) => (props: Props) => {  // Factory receives svc, returns component
    const { el, signal } = svc;
    // ... component logic
    return el('div')(...);
  }
);
```

Props must be JSON-serializable (no functions, signals, or DOM nodes).

### `island(id, strategy, factory)`

Island with custom hydration strategy.

```typescript
import { island } from '@lattice/islands/server';

export const Form = island(
  'form',
  {
    onMismatch(error, container, props, Component, mount) {
      // Preserve user input on mismatch
      const inputs = container.querySelectorAll('input');
      const values = Array.from(inputs).map(i => i.value);

      // Remount with preserved values
      container.innerHTML = '';
      const spec = Component(svc)(props);
      mount(spec);

      // Restore values
      const newInputs = container.querySelectorAll('input');
      newInputs.forEach((input, i) => input.value = values[i]);

      return false; // Skip default fallback
    }
  },
  (svc) => (props: FormProps) => { /* ... */ }
);
```

### `createIsland<Svc, Context>()`

For custom context or service types, create a typed island factory.

```typescript
import { createIsland } from '@lattice/islands/factory';
import type { IslandSvc } from '@lattice/islands/server';

// Custom context type
type AppContext = { user: User; locale: string };

const island = createIsland<IslandSvc, AppContext>();

// Props are inferred, context is typed
export const UserGreeting = island(
  'user-greeting',
  (svc, getContext) => (props: { greeting: string }) => {
    const ctx = getContext(); // AppContext | undefined
    return svc.el('div')(`${props.greeting}, ${ctx?.user.name}!`);
  }
);
```

### Server Preset

```typescript
import { createIslandsServerApp } from '@lattice/islands/server';

const app = createIslandsServerApp();

// Full signals + view service
const { el, signal, computed, effect, map, match } = app;

// Render to HTML with hydration scripts
const { html, scripts } = app.render(App());
```

With context:

```typescript
const app = createIslandsServerApp({
  context: () => ({
    user: req.user,
    locale: req.locale,
  })
});
```

### Client Preset

```typescript
import { createIslandsClientApp } from '@lattice/islands/client';

const app = createIslandsClientApp();

// Full signals + view service
const { el, signal, computed, effect, map, match, on } = app;

// Hydrate islands from server HTML
app.hydrate(Counter, TodoList, Comments);

// Mount new components (for SPA navigation)
app.mount(NewComponent());
```

### `renderToString(nodeRef)`

Convert a rendered node tree to HTML string.

```typescript
import { renderToString } from '@lattice/islands/server';

const nodeRef = App().create(svc);
const html = renderToString(nodeRef);
```

## Types

```typescript
// Island component type
type IslandComponent<TProps> = {
  (props: TProps): RefSpec<unknown>;
};

// Context getter (same signature on server and client)
type GetContext<TContext> = () => TContext | undefined;

// Hydration strategy
type IslandStrategy<TProps, TSvc, TContext> = {
  onMismatch?: (
    error: HydrationMismatch,
    container: HTMLElement,
    props: TProps,
    Component: (svc: TSvc, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>,
    mount: (spec: RefSpec<unknown>) => { element: unknown }
  ) => boolean | void;
};
```

## Fragment Islands

Islands can return fragments (multiple root elements):

```typescript
import { island } from '@lattice/islands/server';

const TableRows = island(
  'table-rows',
  (svc) => ({ items }: { items: Item[] }) => {
    const { map, el } = svc;
    return map(items, (item) => item.id, (item) =>
      el('tr')(
        el('td')(item().name),
        el('td')(item().value)
      )
    );
  }
);

// Usage in static table
el('table')(
  el('thead')(el('tr')(el('th')('Name'), el('th')('Value'))),
  el('tbody')(TableRows({ items }))  // Fragment island
)
```

Fragment islands are wrapped in a container div during SSR, then unwrapped after hydration.

## Installation

```bash
pnpm add @lattice/islands @lattice/signals @lattice/view
```

## License

MIT
