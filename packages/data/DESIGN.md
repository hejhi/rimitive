# Islands Architecture

Ship JavaScript only for interactive components. Static content remains as HTML.

## Quick Example

```ts
// Mark interactive components with island()
const Counter = island('counter',
  create(({ el, signal }) => (props: { initialCount: number }) => {
    const count = signal(props.initialCount);
    return el('button', { onClick: () => count(count() + 1) })
      (`Count: ${count()}`)();
  })
);

// Server: render to HTML, collect island metadata
app.get('/profile', async (req, res) => {
  const userData = await db.user.get(req.session.userId);

  const App = create(({ el }) => () =>
    el('div')(
      el('header')('Profile'),        // Static - 0kb JS
      Counter({ initialCount: 5 })    // Island - ~1kb JS
    )()
  );

  const ctx = createSSRContext();
  const html = runWithSSRContext(ctx, () => renderToString(mount(App())));
  const scripts = getIslandScripts(ctx);

  res.send(renderPage(html, scripts));
});

// Client: hydrate islands only
const hydrator = createDOMIslandHydrator();
hydrator.hydrate({ counter: Counter });
```

## Island Boundaries & State Sharing

**Islands define the server/client boundary.** Components inside an island can share state normally via props:

```ts
// Cart is the island - contains regular components
const Cart = island('cart',
  create(({ el, signal }) => () => {
    const open = signal(false);      // Shared state
    const count = signal(5);

    return el('div')(
      CartButton({ count, onOpenCart: () => open(true) }),
      CartDrawer({ open, onClose: () => open(false) })
    )();
  })
);

// Regular components - receive signals/callbacks as props
const CartButton = create(({ el }) => (props: {
  count: Readable<number>,
  onOpenCart: () => void
}) => {
  return el('button', { onClick: props.onOpenCart })(
    `Cart (${props.count()})`
  )();
});

const CartDrawer = create(({ el, match }) => (props: {
  open: Readable<boolean>,
  onClose: () => void
}) => {
  return match(props.open())({
    true: () => el('div', { class: 'drawer' })('...')(),
    false: () => null
  });
});
```

**Rule**: If components need to share state, they belong under the same island. Lift state up, make the parent the island.

### SSR Safety

**Critical**: Never mutate signals on the server. They persist across requests in Node.js, causing state leakage between users.

```ts
// ❌ UNSAFE - state leaks between requests
export const cartOpen = signal(false);
cartOpen(true); // User A's state leaks to User B

// ✅ SAFE - pass per-request data as props
app.get('/cart', async (req, res) => {
  const cartData = await getCart(req.session.id);
  // ... render with Cart({ initialCount: cartData.count })
});

const Cart = island('cart',
  create(({ el, signal }) => (props: { initialCount: number }) => {
    const count = signal(props.initialCount); // Island-scoped, safe to mutate
    return el('button')(`Cart: ${count()}`)();
  })
);
```

**On client**: Islands can read/write signals freely (no cross-user contamination).

## Implementation

### SSR Context

Uses AsyncLocalStorage for implicit context during rendering:

```ts
// ssr-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface SSRContext {
  islands: Array<{
    id: string;
    type: string;
    props: any;
  }>;
  islandCounter: number;
}

const ssrContextStore = new AsyncLocalStorage<SSRContext>();

export function createSSRContext(): SSRContext {
  return { islands: [], islandCounter: 0 };
}

export function runWithSSRContext<T>(ctx: SSRContext, fn: () => T): T {
  return ssrContextStore.run(ctx, fn);
}

export function getActiveSSRContext(): SSRContext | undefined {
  return ssrContextStore.getStore();
}

export function getIslandScripts(ctx: SSRContext): string {
  return ctx.islands
    .map(i => `<script>window.__hydrate("${i.id}","${i.type}",${JSON.stringify(i.props)});</script>`)
    .join('\n');
}
```

### Island Wrapper

```ts
// island.ts
const ISLAND_META = Symbol.for('lattice.island');

export function island<TProps>(
  id: string,
  component: (props: TProps) => RefSpec<unknown> | SealedSpec<unknown>
): (props: TProps) => RefSpec<unknown> | SealedSpec<unknown>;

export function island<TProps>(
  id: string,
  strategy: IslandStrategy<TProps>,
  component: (props: TProps) => RefSpec<unknown> | SealedSpec<unknown>
): (props: TProps) => RefSpec<unknown> | SealedSpec<unknown>;

export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => RefSpec<unknown>),
  maybeComponent?: (props: TProps) => RefSpec<unknown>
) {
  const component = maybeComponent || strategyOrComponent as any;
  const strategy = maybeComponent ? strategyOrComponent as IslandStrategy<TProps> : undefined;

  const wrapper = (props: TProps) => {
    const spec = component(props);

    const ctx = getActiveSSRContext();
    if (ctx) {
      const instanceId = `${id}-${ctx.islandCounter++}`;
      ctx.islands.push({ id: instanceId, type: id, props });

      // Mark nodeRef for renderToString
      const originalCreate = spec.create.bind(spec);
      spec.create = function(...args: any[]) {
        const nodeRef = originalCreate(...args);
        (nodeRef as any).__islandId = instanceId;
        return nodeRef;
      };
    }

    return spec;
  };

  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy },
    enumerable: false,
  });

  return wrapper;
}
```

**Props must be JSON-serializable** (strings, numbers, booleans, arrays, objects). No functions, signals, or DOM nodes.

### renderToString Integration

Update `@lattice/view/helpers/renderToString.ts` to wrap islands and mark fragment boundaries:

```ts
function renderElementToString(elementRef: ElementRef<unknown>): string {
  const element = elementRef.element as unknown as { outerHTML?: string };

  if (typeof element.outerHTML === 'string') {
    const islandId = (elementRef as any).__islandId;

    if (islandId) {
      return `<div id="${islandId}">${element.outerHTML}</div>`;
    }

    return element.outerHTML;
  }

  throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
}

function renderFragmentToString(fragmentRef: FragmentRef<unknown>): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  const islandId = (fragmentRef as any).__islandId;

  if (islandId) {
    // Mark fragment boundaries for hydration
    parts.push(`<div id="${islandId}"><!--fragment-start-->`);
  }

  while (current) {
    parts.push(renderToString(current as NodeRef<unknown>));
    current = current.next;
  }

  if (islandId) {
    parts.push('<!--fragment-end--></div>');
  }

  return parts.join('');
}
```

**Fragment boundaries**: HTML comments mark where fragments begin/end during hydration. The hydrating renderer uses these to track how many nodes belong to each fragment.

### Hydration Strategy

**Try-with-fallback**: Attempt hydration first (preserves focus, scroll), fall back to replacement on mismatch.

```ts
export interface IslandStrategy<TProps = any> {
  onMismatch?: (
    error: HydrationMismatch,
    containerEl: HTMLElement,
    props: TProps,
    Component: (props: TProps) => RefSpec<unknown>,
    mount: typeof mount
  ) => boolean | void;
}

// Contract:
// - return false → skip default replacement
// - throw → propagate error
// - no return → proceed with default replacement
```

**Helpers** (`@lattice/data/hydration-helpers`):

```ts
import { preserveInputs, failHard, compose } from '@lattice/data/hydration-helpers';

// Preserve form state on mismatch
const Form = island('form', { onMismatch: preserveInputs }, create(...));

// Compose multiple handlers
const Checkout = island('checkout', {
  onMismatch: compose(
    trackMismatch(analytics.track),
    preserveInputs
  )
}, create(...));

// Fail hard for critical islands
const Payment = island('payment', {
  onMismatch: failHard('Payment must hydrate')
}, create(...));
```

### Hydrating Renderer

Returns existing DOM nodes instead of creating new ones:

```ts
// renderers/hydrating-dom.ts
export function createHydratingDOMRenderer(containerEl: HTMLElement) {
  let currentNode: Node | null = containerEl.firstChild;

  // Skip fragment boundary markers
  const skipToNextRealNode = () => {
    while (currentNode?.nodeType === 8) { // Comment node
      const comment = currentNode as Comment;
      if (comment.textContent === 'fragment-start' ||
          comment.textContent === 'fragment-end') {
        currentNode = currentNode.nextSibling;
      } else {
        break;
      }
    }
  };

  return {
    createElement: (tag) => {
      skipToNextRealNode();

      if (currentNode?.nodeType === 1 &&
          (currentNode as Element).tagName.toLowerCase() === tag) {
        const node = currentNode as HTMLElement;
        currentNode = currentNode.nextSibling;
        return node;
      }
      throw new HydrationMismatch(`Expected <${tag}>, got ${currentNode?.nodeName}`);
    },

    createTextNode: (text) => {
      skipToNextRealNode();

      if (currentNode?.nodeType === 3) {
        const node = currentNode as Text;
        if (node.textContent !== text) node.textContent = text;
        currentNode = currentNode.nextSibling;
        return node;
      }
      throw new HydrationMismatch('Expected text node');
    },

    setAttribute: (element, key, value) => Reflect.set(element, key, value),
    appendChild: () => {}, // No-op - already in DOM
    removeChild: () => {}, // No-op during hydration
    insertBefore: () => {}, // No-op during hydration
    isConnected: (element) => element.isConnected,
    addEventListener: (element, event, handler, options) => {
      element.addEventListener(event, handler, options);
      return () => element.removeEventListener(event, handler, options);
    }
  };
}
```

**How it works**:
- Components call `createElement()` in the same order on server and client
- Hydrating renderer walks existing DOM in parallel, returning nodes instead of creating them
- Fragment boundary comments (`<!--fragment-start-->`, `<!--fragment-end-->`) are skipped automatically
- If structure mismatches, throws `HydrationMismatch` → triggers fallback to replacement

### Inert Hydration Mode

During hydration, signals and effects need special handling to prevent unwanted side effects:

**Problem**: When component code runs during hydration:
```ts
const count = signal(props.initialCount);
return el('button')(`Count: ${count()}`)(); // Reading count()
```

Reading `count()` during normal rendering would:
- Track dependencies for reactivity
- Run effects immediately
- Subscribe to updates

But during hydration, we want to:
- ✅ Read current values
- ❌ Don't track dependencies (we're matching existing DOM, not setting up reactivity yet)
- ❌ Don't run effects (DOM already exists)

**Solution**: Internal `__hydrating` flag passed through view context:

```ts
// Inside createDOMIslandHydrator
const hydratingViews = createViewHelpers(hydratingRenderer, signals, {
  __hydrating: true  // Internal flag
});

// Signal implementation checks this flag
export function Signal() {
  return {
    create: (ctx) => (initialValue) => {
      const s = signal(initialValue);

      if (ctx.__hydrating) {
        // Return untracked read during hydration
        return () => s();
      }

      return s; // Normal reactive signal
    }
  };
}

// Effect implementation skips execution during hydration
export function Effect() {
  return {
    create: (ctx) => (fn) => {
      if (ctx.__hydrating) {
        // Queue effect to run after hydration completes
        return () => {}; // No-op cleanup
      }

      return effect(fn); // Normal effect
    }
  };
}
```

After successful hydration, unwrap the container to reveal the hydrated DOM:

```ts
// 1. Hydrate with inert mode (match DOM structure)
const hydratedNode = Component(props).create(hydratingViews);
// Returns existing DOM nodes with event listeners attached
// Signals were created but dependency tracking was disabled

// 2. Success! Unwrap container div, preserving the hydrated nodes
el.replaceWith(...el.childNodes);
// Removes <div id="island-0">, leaves <button>Count: 5</button>

// 3. The same DOM nodes remain in place with event listeners working
//    Signals now track dependencies normally (inert mode complete)
```

**Alternative approach**: Batch all subscriptions and flush after hydration completes. This is more complex but allows effects to see the fully hydrated DOM.

### Client Hydrator

```ts
// hydrators/dom.ts
export function createDOMIslandHydrator(): IslandHydrator {
  return {
    hydrate(registry) {
      window.__hydrate = (id, type, props) => {
        const el = document.getElementById(id);
        if (!el) return;

        const Component = registry[type];
        if (!Component) return;

        const strategy = Component[ISLAND_META]?.strategy;

        try {
          const hydratingRenderer = createHydratingDOMRenderer(el);
          const hydratingViews = createViewHelpers(hydratingRenderer, signals);
          const instance = Component(props).create(hydratingViews);

          const children = Array.from(el.childNodes);
          el.replaceWith(...children);

        } catch (error) {
          if (error instanceof HydrationMismatch) {
            if (strategy?.onMismatch) {
              const result = strategy.onMismatch(error, el, props, Component, mount);
              if (result === false) return;
            }

            console.warn(`Hydration mismatch for "${type}":`, error.message);
            const instance = mount(Component(props));
            el.replaceWith(instance.element);
          }
        }
      };

      window.__islands?.forEach(({ i, t, p }) => window.__hydrate(i, t, p));
    }
  };
}
```

### Server Usage

```ts
app.get('/page', async (req, res) => {
  const App = create(({ el }) => () =>
    el('div')(
      StaticHeader(),
      Cart({ initialCount: 5 })
    )()
  );

  const ctx = createSSRContext();
  const html = runWithSSRContext(ctx, () => renderToString(mount(App())));
  const scripts = getIslandScripts(ctx);

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <script>window.__islands=[];window.__hydrate=(i,t,p)=>__islands.push({i,t,p});</script>
      </head>
      <body>
        ${html}
        ${scripts}
        <script type="module" src="/client.js"></script>
      </body>
    </html>
  `);
});
```

## Hydration Timing & Data Races

**Critical understanding**: Hydration mismatches aren't always bugs.

### Legitimate Data Races

Data can change between server render and client hydration:

```ts
// Server renders at t=0: price = $100
const Product = island('product',
  create(({ el }) => (props: { price: number }) =>
    el('div')(`Price: $${props.price}`)()
  )
);

// Network delay...
// Client hydrates at t=5: price = $120 (price changed in database)
```

**Result**: Hydration mismatch → try-with-fallback replaces with current data.

**This is correct behavior**, not a bug. The alternative (showing stale $100) is worse.

### When Mismatches Indicate Bugs

Mismatches indicate bugs when:
- Conditional rendering based on client-only state (window size, localStorage)
- Random values or timestamps in SSR
- Race conditions in data fetching

```ts
// ❌ Bug - client-only conditional
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
// Always false on server, might be true on client

// ✅ Fix - pass as prop
const Layout = island('layout', create(({ el }) => (props: { isMobile: boolean }) => ...));
```

### Monitoring Hydration Success

Try-with-fallback logs warnings for mismatches. Use these to:
- Track hydration success rate
- Identify data race frequency
- Find client-only conditional bugs

High mismatch rate for rapidly changing data (stock prices, live scores) is expected.
High mismatch rate for static content indicates bugs.

## Package Structure

```
@lattice/data/
  ├── island.ts
  ├── ssr-context.ts
  ├── types.ts
  ├── hydration-helpers.ts
  └── hydrators/
      ├── dom.ts
      └── linkedom.ts

@lattice/view/
  ├── helpers/
  │   └── renderToString.ts     # Update to wrap islands + fragments
  └── renderers/
      └── hydrating-dom.ts      # New
```

## Key Points

- **Islands are boundaries**: Components inside can share state via props
- **Lift state up**: If components need to communicate, make parent the island
- **No nesting**: Don't put islands inside islands
- **JSON props only**: Islands can only receive serializable props
- **SSR safety**: Never mutate signals on server (state leaks between users)
- **Try-with-fallback**: Preserves UX when possible, degrades gracefully
