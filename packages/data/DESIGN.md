# Islands Architecture - Lattice SSR Design

## Overview

True islands architecture for Lattice: only ship JavaScript for interactive components, keep static content as static HTML.

**Key principles:**
- Islands are marked by **interactivity need**, not data dependency
- Platform-agnostic (same pattern as renderers)
- HTML bootstrap hydration (no DOM queries, progressive)
- Framework-agnostic data fetching (use whatever you want)

## How It Works

### 1. Mark Interactive Components

```ts
import { island } from '@lattice/data';

// Interactive - needs client JS
const Counter = island('counter',
  create(({ el, signal }) => (initialCount: number) => {
    const count = signal(initialCount);
    return el('button', { onClick: () => count(count() + 1) })
      (`Count: ${count()}`);
  })
);

// Static - just HTML
const Header = create(({ el }) => (title: string) => {
  return el('header')(el('h1')(title));
});
```

### 2. Fetch Data (Any Pattern)

```ts
// Use loaders, API calls, DB queries - whatever you want
export async function loader({ params }) {
  const [user, posts] = await Promise.all([
    db.user.findUnique({ where: { id: params.id } }),
    db.post.findMany({ where: { authorId: params.id } })
  ]);
  return { user, posts };
}
```

### 3. Render on Server

```ts
app.get('/profile/:id', async (req, res) => {
  const data = await loader({ params: req.params });

  const App = create(({ el }) => () => {
    return el('div')(
      Header(data.user.name),    // Static - 0kb JS
      Counter(data.views),        // Island - ~1kb JS
      TodoList(data.posts)        // Island - ~2kb JS
    );
  });

  const html = renderToString(mount(App()));
  res.send(html);
});
```

Server outputs HTML with inline hydration scripts:
```html
<div id="island-1"><button>Count: 5</button></div>
<script>window.__hydrate('island-1', 'counter', {initialCount: 5});</script>
```

### 4. Hydrate on Client

```ts
// client.ts
import { createDOMIslandHydrator } from '@lattice/data/hydrators/dom';

const hydrator = createDOMIslandHydrator();

// Only register islands (Header not included)
hydrator.hydrate({
  'counter': Counter,
  'todo-list': TodoList,
}, mount);
```

The hydrator sets up `window.__hydrate()` which is called by inline scripts. Each island hydrates progressively as the browser parses HTML.

## Platform-Agnostic Design

Following the same pattern as renderers:

```ts
// Core (platform-agnostic)
export function island<T>(id: string, component: T): T;
export interface IslandHydrator {
  hydrate(registry: Record<string, any>, mount: any): void;
}

// Platform-specific implementations
export function createDOMIslandHydrator(): IslandHydrator;      // Browser
export function createLinkedomIslandHydrator(): IslandHydrator; // SSR (no-op)
export function createRNIslandHydrator(): IslandHydrator;       // React Native
```

**Package structure:**
```
@lattice/data/
  ├── island.ts              # Platform-agnostic marker
  ├── types.ts               # IslandHydrator interface
  ├── hydrators/
  │   ├── dom.ts             # HTML bootstrap pattern
  │   ├── linkedom.ts        # SSR no-op
  │   └── react-native.ts    # Native (future)
  └── serializers/
      └── html.ts            # Inline script generation
```

## Benefits

**Minimal JavaScript**
Only interactive components ship to client. Static header/footer = 0kb JS.

**Progressive Enhancement**
Static content works without JavaScript. Islands self-hydrate via inline scripts (no waiting for external bundles).

**Platform Agnostic**
Same `island()` works on browser, server, React Native. Just swap hydrators.

**Zero Boilerplate**
One wrapper: `island('name', component)`. No special syntax, no compiler directives.

**Type Safe**
Full TypeScript inference through component props.

**Framework Agnostic**
Use any data fetching pattern: loaders, GraphQL, tRPC, direct DB access.

## Working Example

```ts
// Server
export async function loader() {
  return {
    todos: await db.todo.findMany(),
    stats: await db.stats.get()
  };
}

app.get('/todos', async (req, res) => {
  const data = await loader();

  const App = create(({ el }) => () => {
    return el('div')(
      Header('My Todos'),               // Static
      Counter(data.stats.totalViews),   // Island
      TodoList(data.todos),             // Island
      Footer()                          // Static
    );
  });

  res.send(renderPage(App));
});

// Components
const Header = create(({ el }) => (title: string) => {
  return el('header')(el('h1')(title));
});

const Counter = island('counter',
  create(({ el, signal }) => (initialCount: number) => {
    const count = signal(initialCount);
    return el('button', { onClick: () => count(count() + 1) })
      (`Count: ${count()}`);
  })
);

const TodoList = island('todo-list',
  create(({ el, signal }) => (initialTodos: Todo[]) => {
    const todos = signal(initialTodos);
    const input = signal('');

    return el('div')(
      el('input', { value: input, onInput: (e) => input(e.target.value) }),
      el('button', { onClick: () => {
        todos([...todos(), { id: Date.now(), text: input() }]);
        input('');
      }})('Add'),
      el('ul')(...todos().map(todo => el('li')(todo.text)))
    );
  })
);

// Client
const hydrator = createDOMIslandHydrator();
hydrator.hydrate({
  'counter': Counter,
  'todo-list': TodoList
}, mount);
```

Result: Static components render as HTML only. Only Counter and TodoList ship client JS.

## Open Questions

**Props Serialization**
Currently restricted to JSON-serializable props. Event handlers defined in component, only data serialized.

**Hydration Mismatches**
Current approach: always replace server HTML. Could add strict matching with warnings in dev mode.

**Build Tooling**
Start with manual registration, add automatic island discovery via bundler plugin later.

**Island Communication**
Start with URL params and props drilling. Add shared signals or context if needed.

## Comparison to Other Frameworks

**vs Astro** - Framework-agnostic (not locked to React/Vue/etc), simpler API
**vs Qwik** - Explicit marking (no compiler magic), works on any platform
**vs Next.js RSC** - Islands pattern (simpler than streaming), no bundler coupling
**vs Fresh** - Framework-agnostic (not Preact-specific), runtime-agnostic

## Next Steps

1. Implement core primitives (`island()`, `IslandHydrator`)
2. Build DOM and Linkedom hydrators
3. Create example SSR app
4. Add dev mode tooling (visualize islands, hydration stats)
5. Explore build tool integration for automatic island detection
