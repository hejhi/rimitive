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

// Static components - no island wrapper needed
const Header = create(({ el }) => (title: string) =>
  el('header')(el('h1')(title))()
);

// Server: render to HTML, collect island metadata
app.get('/profile', async (req, res) => {
  const userData = await db.user.get(req.session.userId);

  const App = create(({ el }) => () =>
    el('div')(
      Header('Profile'),           // Static - 0kb JS
      Counter({ initialCount: 5 }) // Island - ~1kb JS
    )()
  );

  const ctx = createSSRContext();
  const html = runWithSSRContext(ctx, () => renderToString(mount(App())));
  const scripts = getIslandScripts(ctx);

  res.send(renderPage(html, scripts));
});

// Client: hydrate islands only (preserves state when possible)
const hydrator = createDOMIslandHydrator();
hydrator.hydrate({ counter: Counter });
```

## SSR State Management

**Critical**: Module-level signals persist across requests in Node.js, causing state leakage.

### Server: Never Mutate Module-Level Signals

```ts
// ❌ UNSAFE - state leaks between requests
export const menuOpen = signal(false);
menuOpen(true); // User A's state leaks to User B

// ✅ SAFE - pass per-request data as props
app.get('/cart', async (req, res) => {
  const cartData = await getCart(req.session.id);
  // ... render with CartButton({ count: cartData.count })
});

const CartButton = island('cart-button',
  create(({ el, signal }) => (props: { count: number }) => {
    const count = signal(props.count); // Island-scoped, safe to mutate
    return el('button')(`Cart: ${count()}`)();
  })
);
```

### Client: Module-Level Signals Are Safe

Islands can share state via module-level signals (no cross-user contamination):

```ts
// stores/cart.ts
export const cartOpen = signal(false);
export const cartCount = signal(0);

// Islands communicate through shared signals
const CartButton = island('cart-button', create(({ el }) => () =>
  el('button', { onClick: () => cartOpen(true) })(`Cart (${cartCount()})`)()
));

const CartDrawer = island('cart-drawer', create(({ el, match }) => () =>
  match(cartOpen())({
    true: () => el('div', { class: 'drawer' })('...')(),
    false: () => null
  })
));
```

**Rule**: Server = props only, Client = module-level signals OK.

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
    strategy?: IslandStrategy;
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
    .map(i => {
      const args = [i.id, i.type, i.props, i.strategy].filter(x => x !== undefined);
      return `<script>window.__hydrate(${args.map(a => JSON.stringify(a)).join(',')});</script>`;
    })
    .join('\n');
}
```

### Island Wrapper

```ts
// island.ts
const ISLAND_META = Symbol.for('lattice.island');
const registeredIslands = new Set<string>();

// Overload signatures
export function island<TProps>(
  id: string,
  component: (props: TProps) => RefSpec<unknown> | SealedSpec<unknown>
): typeof component;

export function island<TProps>(
  id: string,
  strategy: IslandStrategy<TProps>,
  component: (props: TProps) => RefSpec<unknown> | SealedSpec<unknown>
): typeof component;

export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => RefSpec<unknown>),
  maybeComponent?: (props: TProps) => RefSpec<unknown>
): typeof component {
  // Handle both signatures
  const component = maybeComponent || strategyOrComponent as any;
  const strategy = maybeComponent ? strategyOrComponent as IslandStrategy<TProps> : undefined;

  // Dev mode: detect duplicate island IDs
  if (process.env.NODE_ENV === 'development') {
    if (registeredIslands.has(id)) {
      console.warn(`Duplicate island ID: "${id}"`);
    }
    registeredIslands.add(id);
  }

  const wrapper = (props: TProps) => {
    // Dev mode: validate props are JSON-serializable
    if (process.env.NODE_ENV === 'development') {
      try {
        JSON.parse(JSON.stringify(props));
      } catch (e) {
        console.error(`Island "${id}" has non-serializable props:`, props);
      }
    }

    const spec = component(props);

    const ctx = getActiveSSRContext();
    if (ctx) {
      // SSR: Mark spec to be wrapped during rendering
      const instanceId = `${id}-${ctx.islandCounter++}`;
      ctx.islands.push({ id: instanceId, type: id, props, strategy });

      // Intercept spec.create() to mark the resulting nodeRef
      const originalCreate = spec.create.bind(spec);
      spec.create = function(...args: any[]) {
        const nodeRef = originalCreate(...args);
        (nodeRef as any).__islandId = instanceId;
        return nodeRef;
      };
    }

    return spec; // Type consistent: always returns TSpec
  };

  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy },
    enumerable: false,
  });

  return wrapper as typeof component;
}
```

**Key points**:
- Supports both `island(id, component)` and `island(id, strategy, component)` signatures
- Strategy passed through SSR context to client hydrator
- Intercepts `spec.create()` to mark nodeRef with `__islandId`
- Type consistent: always returns `TSpec` (no SSR vs client type mismatch)
- Props must be JSON-serializable (validated in dev mode)

### renderToString Integration

Islands need wrapping during the render phase. Update `@lattice/view/helpers/renderToString.ts`:

```ts
function renderElementToString(elementRef: ElementRef<unknown>): string {
  const element = elementRef.element as unknown as { outerHTML?: string };

  if (typeof element.outerHTML === 'string') {
    const islandId = (elementRef as any).__islandId;

    if (islandId) {
      // Wrap islands in container div for client hydration
      return `<div id="${islandId}">${element.outerHTML}</div>`;
    }

    return element.outerHTML;
  }

  throw new Error('Element does not have outerHTML property. Are you using linkedom renderer?');
}
```

**Flow**:
1. `island()` wraps `spec.create()` to mark nodeRef with `__islandId`
2. `mount(spec)` calls `spec.create(views)` → nodeRef with `__islandId`
3. `renderToString(nodeRef)` detects `__islandId` and wraps in container

### Hydration Strategy: Try-With-Fallback

**Default behavior**: Attempt hydration first (preserves input focus, scroll position), fall back to replacement on mismatch.

```ts
// Client hydration logic
try {
  // Try to hydrate existing DOM (preserves state)
  const hydratingRenderer = createHydratingDOMRenderer(containerEl);
  const instance = Component(props).create(hydratingViews);
  containerEl.replaceWith(...containerEl.childNodes); // Unwrap container
} catch (HydrationMismatch) {
  // Call custom handler if provided
  if (strategy?.onMismatch) {
    const result = strategy.onMismatch(error, el, props, Component, mount);
    if (result === false) return; // Handler dealt with it
  }

  // Default: warn and replace
  console.warn(`Hydration mismatch, replacing island "${type}"`);
  const instance = mount(Component(props));
  containerEl.replaceWith(instance.element);
}
```

**Custom Mismatch Handlers**:

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
// - return false → "I handled it, skip default replacement"
// - throw → "Critical error, propagate to caller"
// - no return / truthy → "Proceed with default replacement"
```

**Helper Utilities** (`@lattice/data/hydration-helpers`):

```ts
import { preserveInputs, logMismatch, compose } from '@lattice/data/hydration-helpers';

// Preserve form inputs across replacement
const SearchForm = island('search', {
  onMismatch: preserveInputs
}, component);

// Log before default replacement
const Widget = island('widget', {
  onMismatch: logMismatch(logger.error)
}, component);

// Compose multiple handlers
const CheckoutForm = island('checkout', {
  onMismatch: compose(
    trackMismatch(analytics.track),  // Track event
    preserveInputs                    // Then preserve inputs
  )
}, component);
```

**Benefits**:
- ✅ Preserves user input, focus, scroll position (when hydration succeeds)
- ✅ Customizable recovery strategies (preserve state, fail hard, log, etc.)
- ✅ Tree-shakeable helpers (import only what you need)
- ✅ Telemetry via console warnings (track hydration success rate)

**Inline Script Queue** (streaming-friendly, ~100 bytes):

```html
<head>
  <script>window.__islands=[];window.__hydrate=(i,t,p)=>__islands.push({i,t,p});</script>
</head>
<body>
  <div id="counter-0"><button>Count: 5</button></div>
  <script>window.__hydrate("counter-0","counter",{"initialCount":5});</script>
  <script type="module" src="/client.js"></script>
</body>
```

### Client Hydrator

```ts
// hydrators/dom.ts
export function createDOMIslandHydrator(): IslandHydrator {
  return {
    hydrate(registry) {
      window.__hydrate = (id, type, props, strategy) => {
        const el = document.getElementById(id);
        if (!el) return;

        const Component = registry[type];
        if (!Component) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Island "${type}" not registered`);
          }
          return; // Leave server HTML
        }

        try {
          // Try hydration first (preserves state)
          const hydratingRenderer = createHydratingDOMRenderer(el);
          const hydratingViews = createViewHelpers(hydratingRenderer, signals);
          const instance = Component(props).create(hydratingViews);

          // Success - unwrap container (works for elements and fragments)
          const children = Array.from(el.childNodes);
          el.replaceWith(...children);

        } catch (error) {
          if (error instanceof HydrationMismatch) {
            // Call custom handler if provided
            if (strategy?.onMismatch) {
              const result = strategy.onMismatch(error, el, props, Component, mount);
              if (result === false) return; // Handler dealt with it
            }

            // Default: warn and replace
            console.warn(`Hydration mismatch for "${type}":`, error.message);
            const instance = mount(Component(props));
            el.replaceWith(instance.element);
          } else {
            console.error(`Failed to hydrate "${type}":`, error);
          }
        }
      };

      // Process queued islands
      window.__islands?.forEach(({ i, t, p, s }) => window.__hydrate(i, t, p, s));
    }
  };
}
```

### Server Usage

```ts
import { createSSRContext, runWithSSRContext, getIslandScripts } from '@lattice/data/ssr-context';
import { renderToString } from '@lattice/view/helpers/renderToString';

app.get('/profile', async (req, res) => {
  const userData = await db.user.get(req.session.userId);

  const App = create(({ el }) => () => {
    return el('div')(
      Header('Profile'),
      CartButton({ count: userData.cartCount })
    )();
  });

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

### Hydrating Renderer

Returns existing DOM nodes instead of creating new ones:

```ts
// renderers/hydrating-dom.ts
export function createHydratingDOMRenderer(containerEl: HTMLElement) {
  let currentNode: Node | null = containerEl.firstChild;

  return {
    createElement: (tag) => {
      if (currentNode?.nodeType === 1 &&
          (currentNode as Element).tagName.toLowerCase() === tag) {
        const node = currentNode as HTMLElement;
        currentNode = currentNode.nextSibling;
        return node;
      }
      throw new HydrationMismatch(`Expected <${tag}>, got ${currentNode?.nodeName}`);
    },

    createTextNode: (text) => {
      if (currentNode?.nodeType === 3) {
        const node = currentNode as Text;
        if (node.textContent !== text) node.textContent = text; // Patch differences
        currentNode = currentNode.nextSibling;
        return node;
      }
      throw new HydrationMismatch('Expected text node');
    },

    setAttribute: (element, key, value) => Reflect.set(element, key, value),
    appendChild: () => {}, // No-op - already exists
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

**Key insight**: Components call `createElement()` in the same order on server and client. The hydrating renderer walks the existing DOM tree in parallel, returning nodes instead of creating them.

### Hydration Helpers

Common recovery strategies as tree-shakeable utilities:

```ts
// @lattice/data/hydration-helpers.ts

/**
 * Preserve form input values across replacement
 */
export function preserveInputs(
  error: HydrationMismatch,
  el: HTMLElement,
  props: any,
  Component: any,
  mount: any
): false {
  // Capture input state
  const inputs = el.querySelectorAll('input, textarea, select');
  const values = Array.from(inputs).map((input: any) => ({
    name: input.name || input.id,
    value: input.value,
    checked: input.checked,
    selectedIndex: input.selectedIndex,
  }));

  // Replace with new instance
  const instance = mount(Component(props));
  el.replaceWith(instance.element);

  // Restore input state
  values.forEach(({ name, value, checked, selectedIndex }) => {
    const selector = name ? `[name="${name}"], #${name}` : null;
    const input: any = selector ? instance.element.querySelector(selector) : null;
    if (input) {
      if (value !== undefined) input.value = value;
      if (checked !== undefined) input.checked = checked;
      if (selectedIndex !== undefined) input.selectedIndex = selectedIndex;
    }
  });

  return false; // Skip default replacement
}

/**
 * Leave server HTML (island becomes non-interactive)
 */
export function leaveServerHTML(error: HydrationMismatch, el: HTMLElement): false {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Leaving server HTML due to mismatch: ${error.message}`, el);
  }
  return false;
}

/**
 * Factory: Log to custom logger before default replacement
 */
export function logMismatch(
  logger: (message: string, error: HydrationMismatch, el: HTMLElement) => void
) {
  return (error: HydrationMismatch, el: HTMLElement) => {
    logger('Hydration mismatch', error, el);
    // Fall through to default replacement
  };
}

/**
 * Factory: Track analytics event before default replacement
 */
export function trackMismatch(
  tracker: (event: string, data: Record<string, any>) => void
) {
  return (error: HydrationMismatch, el: HTMLElement) => {
    tracker('hydration_mismatch', {
      error: error.message,
      elementId: el.id,
    });
    // Fall through to default replacement
  };
}

/**
 * Factory: Fail hard for critical islands
 */
export function failHard(customMessage?: string) {
  return (error: HydrationMismatch) => {
    throw new Error(customMessage || `Critical hydration failure: ${error.message}`);
  };
}

/**
 * Compose multiple handlers (runs all, respects first false return)
 */
export function compose(...handlers: OnMismatchHandler[]): OnMismatchHandler {
  return (error, el, props, Component, mount) => {
    for (const handler of handlers) {
      const result = handler(error, el, props, Component, mount);
      if (result === false) return false;
    }
    // Fall through to default if no handler returned false
  };
}
```

## Constraints & Tradeoffs

**Props**: Must be JSON-serializable (strings, numbers, booleans, arrays, plain objects). No functions, signals, or DOM nodes. Dev mode validates.

**Hydration**: Tries to preserve existing DOM first (keeps input focus, scroll position). Falls back to replacement if server/client structures mismatch. Data changes between render and hydration cause mismatches.

**Registry**: Manual for v1. Island IDs must match between `island('id', ...)` and `hydrator.hydrate({ id: ... })`. Dev mode warns on mismatches.

**Container Wrapper**: Islands wrapped in `<div id="island-{n}">` during SSR. Unwrapped after successful hydration.

**Custom Handlers**: Optional `onMismatch` strategy for custom recovery. Return `false` to skip default replacement, `throw` to propagate errors, or fall through for default behavior.

## Package Structure

```
@lattice/data/
  ├── island.ts                 # island() wrapper with strategy support
  ├── ssr-context.ts            # SSR context + AsyncLocalStorage
  ├── types.ts                  # IslandHydrator, IslandStrategy interfaces
  ├── hydration-helpers.ts      # Tree-shakeable helper utilities (NEW)
  └── hydrators/
      ├── dom.ts                # Browser hydration (try-with-fallback)
      └── linkedom.ts           # SSR no-op

@lattice/view/
  ├── helpers/
  │   └── renderToString.ts     # Update to detect __islandId and wrap
  └── renderers/
      └── hydrating-dom.ts      # Hydrating renderer (NEW)
```

**Exports** (`@lattice/data/package.json`):
```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./hydration-helpers": {
      "import": "./dist/hydration-helpers.js",
      "types": "./dist/hydration-helpers.d.ts"
    }
  }
}
```

## Why This Design Works

**Lattice's advantages for islands**:
1. **Fine-grained reactivity**: Signals work independently without global context
2. **No VDOM**: Hydration is simpler - just match createElement() calls in order
3. **Renderer abstraction**: Same component code runs on server (linkedom) and client (DOM/hydrating)
4. **Small bundles**: Each island is self-contained (~1kb gzipped)

**Try-with-fallback rationale**:
- Hydration preserves state when possible (better UX on slow networks)
- Fallback handles edge cases reliably (data changes, conditional rendering)
- ~2x complexity vs replace-only, but worth it for UX improvement
- Telemetry shows when/why hydration fails (guides optimization)

## Implementation Estimate

| Component | Lines of Code | Time |
|-----------|---------------|------|
| Hydrating renderer | ~100 | 1 hour |
| Fragment support | ~50 | 30 min |
| Client hydrator updates | ~50 | 30 min |
| Island strategy support | ~40 | 30 min |
| Hydration helpers | ~120 | 1 hour |
| Error handling | ~20 | 15 min |
| Types | ~30 | 15 min |
| Tests | ~160 | 1.5 hours |
| **Total** | **~570** | **~5.5 hours** |

## Next Steps

1. Implement hydrating renderer (`@lattice/view/renderers/hydrating-dom.ts`)
2. Update `renderToString()` to wrap islands (`@lattice/view/helpers/renderToString.ts`)
3. Implement `island()` with strategy support (`@lattice/data/island.ts`)
4. Update SSR context to pass strategy to client (`@lattice/data/ssr-context.ts`)
5. Implement hydration helpers (`@lattice/data/hydration-helpers.ts`)
6. Update DOM hydrator to call `onMismatch` handlers (`@lattice/data/hydrators/dom.ts`)
7. Build example SSR app to validate approach
8. Phase 2: Build tooling for automatic island discovery and manifest generation

## Usage Patterns Summary

```ts
// Simple island (no strategy)
const Counter = island('counter', create(({ el, signal }) => ...));

// With input preservation
import { preserveInputs } from '@lattice/data/hydration-helpers';
const Form = island('form', { onMismatch: preserveInputs }, create(...));

// With analytics tracking
import { compose, trackMismatch, preserveInputs } from '@lattice/data/hydration-helpers';
const Checkout = island('checkout', {
  onMismatch: compose(
    trackMismatch(analytics.track),
    preserveInputs
  )
}, create(...));

// Critical island (fail hard on mismatch)
import { failHard } from '@lattice/data/hydration-helpers';
const Payment = island('payment', {
  onMismatch: failHard('Payment form must hydrate successfully')
}, create(...));

// Custom handler
const Search = island('search', {
  onMismatch: (error, el, props, Component, mount) => {
    // Custom recovery logic
    if (shouldPreserve(error)) {
      return preserveInputs(error, el, props, Component, mount);
    }
    // Fall through to default replacement
  }
}, create(...));
```
