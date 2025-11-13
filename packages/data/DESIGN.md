# Islands Architecture

Ship JavaScript only for interactive components. Static content remains HTML.

## Quick Example

```ts
// Mark interactive components
const Counter = island('counter',
  create(({ el, signal }) => (props: { initialCount: number }) => {
    const count = signal(props.initialCount);
    return el('button', { onClick: () => count(count() + 1) })(`Count: ${count()}`)();
  })
);

// Server: render HTML + inline hydration scripts
app.get('/page', async (req, res) => {
  const ctx = createSSRContext();
  const html = runWithSSRContext(ctx, () =>
    renderToString(mount(App()))
  );
  res.send(html); // Scripts already inlined per-island
});

// Client: register islands, auto-hydrate
hydrator.hydrate({ counter: Counter });
```

## State Sharing

**Rule**: If components share state, they belong under the same island.

```ts
// Cart is the island boundary
const Cart = island('cart',
  create(({ el, signal }) => () => {
    const open = signal(false);
    return el('div')(
      CartButton({ open, toggle: () => open(!open()) }),
      CartDrawer({ open })
    )();
  })
);

// Regular components receive signals as props
const CartButton = create(({ el }) => (props: { open: Readable<boolean>, toggle: () => void }) =>
  el('button', { onClick: props.toggle })(`Cart ${props.open() ? '▼' : '▶'}`)()
);
```

Cross-island communication: use URL state, custom events, or shared modules (see SSR Safety below).

## SSR Safety

**Never mutate module-level signals on the server** - they persist across requests:

```ts
// ❌ Module-level signal mutated on server = state leak
export const count = signal(0);
count(count() + 1); // User A's state leaks to User B

// ✅ Create signals inside islands = request-scoped
const Counter = island('counter',
  create(({ signal }) => (props: { initial: number }) => {
    const count = signal(props.initial); // Safe - new per request
    // ...
  })
);
```

On client, all signals are safe to mutate, though module-level signals should not be used in general.

## Implementation

### SSR Context

AsyncLocalStorage tracks islands during render:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface SSRContext {
  islands: Array<{ id: string; type: string; props: any }>;
  counter: number;
}

const store = new AsyncLocalStorage<SSRContext>();

export const createSSRContext = () => ({ islands: [], counter: 0 });
export const runWithSSRContext = (ctx, fn) => store.run(ctx, fn);
export const getActiveSSRContext = () => store.getStore();
```

### Island Wrapper

Registers island during SSR, marks nodeRef for hydration.

Props must be JSON-serializable (strings, numbers, booleans, arrays, plain objects).

### renderToString Integration

Wrap islands in containers and emit inline scripts. Watch out for XSS vulnurabilities.

Scripts emit immediately after each island for parallel loading. HTML comments (`<!--f-->`) mark fragment boundaries.

### Hydration Strategy

**Try-with-fallback**: Hydrate first (preserves focus, scroll), replace on mismatch.

Mismatches log warnings. High rate for static content = bug. High rate for live data (prices, scores) = expected.

### Hydrating Renderer

Returns existing DOM nodes instead of creating new ones. Each island gets its own renderer instance (isolated cursor). Example:

```ts
export function createHydratingDOMRenderer(containerEl: HTMLElement) {
  let cursor = containerEl.firstChild;

  const skipComments = () => {
    while (cursor?.nodeType === 8 && /^\/?(f|fragment)$/.test(cursor.textContent)) {
      cursor = cursor.nextSibling;
    }
  };

  return {
    createElement: (tag) => {
      skipComments();
      if (cursor?.nodeType === 1 && cursor.tagName.toLowerCase() === tag) {
        const node = cursor;
        cursor = cursor.nextSibling;
        return node;
      }
      throw new HydrationMismatch(`Expected <${tag}>, got ${cursor?.nodeName}`);
    },
    createTextNode: (text) => {
      skipComments();
      if (cursor?.nodeType === 3) {
        const node = cursor;
        cursor = cursor.nextSibling;
        return node;
      }
      throw new HydrationMismatch('Expected text');
    },
    // ...
  };
}
```

### Effect Deferral

During hydration, effects should not run (DOM already exists). Defer them until after hydration completes.

**Important constraint**: signals and view packages should not be aware of hydration, islands, or ssr.

### Server Usage

```ts
app.get('/page', async (req, res) => {
  const ctx = createSSRContext();
  const html = runWithSSRContext(ctx, () =>
    renderToString(mount(App()))
  );

  res.send(`<!DOCTYPE html>
    <html>
      <body>
        ${html}
        <script type="module" src="/client.js"></script>
      </body>
    </html>`);
});
```

Scripts are already inlined after each island. Client bundle just needs to register and call `hydrate()`.

## Data Races & Mismatches

Hydration mismatches aren't always bugs. Data can change between server render and client hydration:

```ts
// t=0 (server): price = $100
const Product = island('product', create(({ el }) => (props: { price: number }) =>
  el('div')(`Price: $${props.price}`)()
));

// t=5 (client): price = $120 (changed in database)
// Result: Mismatch → fallback → show $120
```

**This is correct**. Showing stale data is worse.

### Actual Bugs

Mismatches indicate bugs when caused by:
- Client-only conditionals (`window.innerWidth`, `localStorage`)
- Random values or timestamps in SSR
- Race conditions in data fetching

```ts
// ❌ Client-only conditional
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// ✅ Pass as prop from server
const Layout = island('layout', create(({ el }) => (props: { isMobile: boolean }) => ...));
```

High mismatch rate for live data = expected. High rate for static content = bug.

## Package Structure

```
@lattice/data/
  ├── island.ts              # island() wrapper
  ├── ssr-context.ts         # AsyncLocalStorage context
  ├── hydrating-api.ts       # Effect deferral
  └── hydrators/
      └── dom.ts             # Client hydrator

@lattice/view/
  ├── helpers/
  │   └── renderToString.ts  # Update to wrap islands + emit scripts
  └── renderers/
      └── hydrating-dom.ts   # New renderer
```

## Key Design Decisions

- **No build tooling required**: Manual island registry, optional tooling later
- **Try-with-fallback**: Pragmatic over strict (data races are legitimate)
- **Effect interception**: Keeps signals/view packages decoupled from islands
- **Inline scripts**: Parallel island loading during HTML streaming
- **JSON props only**: Validated at runtime with clear errors
- **No island nesting**: Keep mental model simple (can revisit later)
