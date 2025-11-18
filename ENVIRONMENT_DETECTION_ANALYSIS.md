# Environment Detection Pattern: Islands → Router

## Executive Summary

This document analyzes how `@lattice/islands` uses environment detection to create ONE universal API that works in both server and client contexts, and shows how to apply the same pattern to `@lattice/router`.

**Key Pattern**: Runtime environment detection using AsyncLocalStorage, NOT build-time conditionals or separate presets.

---

## How @lattice/islands Does It

### 1. Environment Detection Mechanism

**File: `/packages/islands/src/ssr-context.ts`**

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

const ssrContextStore = new AsyncLocalStorage<SSRContext>();

export function getActiveSSRContext(): SSRContext | undefined {
  return ssrContextStore.getStore();
}
```

**How it works**:
- `AsyncLocalStorage` is Node.js-specific (only available on server)
- In browser environments, this import would fail OR the store is always empty
- Returns `undefined` when running in browser (no active context)
- Returns `SSRContext` when running on server (within `runWithSSRContext()`)

### 2. Universal API with Runtime Branching

**File: `/packages/islands/src/island.ts` (lines 80-121)**

```typescript
export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => SealedSpec<unknown>),
  maybeComponent?: (props: TProps) => SealedSpec<unknown>
): IslandComponent<TProps> {
  const component = maybeComponent || (strategyOrComponent as (props: TProps) => SealedSpec<unknown>);
  const strategy = maybeComponent ? (strategyOrComponent as IslandStrategy<TProps>) : undefined;

  const wrapper = ((props: TProps) => {
    const spec = component(props);

    // 🔑 KEY PATTERN: Runtime environment check
    if (!getActiveSSRContext()) return spec;

    // Server-side: Register island and tag nodeRef
    const instanceId = registerIsland(id, props);

    return {
      status: spec.status,
      create(api?: unknown) {
        const nodeRef = spec.create(api) as IslandNodeRef<unknown>;
        nodeRef.__islandId = instanceId;

        if ('element' in nodeRef && nodeRef.element) {
          const element = nodeRef.element as { setAttribute?: (name: string, value: string) => void };
          if (element.setAttribute) {
            element.setAttribute('data-island-id', instanceId);
          }
        }

        return nodeRef;
      },
    };
  });

  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy, component },
    enumerable: false,
  });

  return wrapper;
}
```

**What happens**:
- **Client**: `getActiveSSRContext()` returns `undefined` → component runs normally
- **Server**: `getActiveSSRContext()` returns context → registers island, adds metadata

### 3. Package.json Exports (Alternative Approach)

**File: `/packages/islands/package.json`**

```json
{
  "exports": {
    "./island": {
      "browser": {
        "import": "./dist/island.browser.js",
        "types": "./dist/island.browser.d.ts"
      },
      "import": "./dist/island.js",
      "types": "./dist/island.d.ts"
    }
  }
}
```

**Note**: Islands uses BOTH approaches:
1. Runtime detection (primary) for universal API
2. Package exports (secondary) for optimization - browser gets lighter bundle

---

## How Router Should Do It

### Strategy: Runtime Environment Detection (Like Islands)

The router should use the **same AsyncLocalStorage pattern** to detect environment and branch behavior at runtime.

---

## Proposed Implementation

### 1. Create SSR Context Module

**New file: `/packages/router/src/ssr-context.ts`**

```typescript
/**
 * SSR Context for Router
 *
 * Determines if we're running on server or client using AsyncLocalStorage.
 * In browser, AsyncLocalStorage doesn't exist or store is empty.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RouterSSRContext {
  initialPath: string;
}

const routerContextStore = new AsyncLocalStorage<RouterSSRContext>();

/**
 * Get active SSR context
 *
 * @returns Context if running on server, undefined if running in browser
 */
export function getActiveRouterContext(): RouterSSRContext | undefined {
  return routerContextStore.getStore();
}

/**
 * Run function within SSR context (server only)
 */
export function runWithRouterContext<T>(ctx: RouterSSRContext, fn: () => T): T {
  return routerContextStore.run(ctx, fn);
}

/**
 * Create SSR context for rendering (server only)
 */
export function createRouterContext(initialPath: string): RouterSSRContext {
  return { initialPath };
}
```

---

### 2. Universal `currentPath` Signal

**Update: `/packages/router/src/location.ts`**

```typescript
import { create } from '@lattice/lattice';
import type { LocationOpts, LocationFactory, LocationAPI } from './types';
import { getActiveRouterContext } from './ssr-context';

/**
 * Create currentPath signal with environment detection
 *
 * - Server: Reads from SSR context
 * - Client: Reads from window.location
 */
export function createCurrentPathSignal(signal: <T>(v: T) => { (): T; (v: T): void }) {
  const ssrContext = getActiveRouterContext();

  if (ssrContext) {
    // SERVER: Use initial path from SSR context
    return signal(ssrContext.initialPath);
  } else {
    // CLIENT: Read from window.location
    return signal(window.location.pathname + window.location.search + window.location.hash);
  }
}

export const createLocationFactory = create(
  ({ computed, currentPath }: LocationOpts) => {
    return () => {
      function location(): LocationAPI {
        const pathname = computed(() => {
          const path = currentPath();
          return parseURL(path).pathname;
        });

        const search = computed(() => {
          const path = currentPath();
          return parseURL(path).search;
        });

        const hash = computed(() => {
          const path = currentPath();
          return parseURL(path).hash;
        });

        const query = computed(() => {
          const path = currentPath();
          const { search: searchString } = parseURL(path);
          return parseQueryString(searchString);
        });

        return { pathname, search, hash, query };
      }

      const extension: LocationFactory = {
        name: 'location' as const,
        method: location,
      };

      return extension;
    };
  }
);
```

---

### 3. Universal `navigate()` Function

**New file: `/packages/router/src/navigate.ts`**

```typescript
/**
 * Universal navigate function with environment detection
 */

import { getActiveRouterContext } from './ssr-context';

export type NavigateOptions = {
  replace?: boolean;
};

/**
 * Navigate to a new path
 *
 * - Server: No-op (or updates signal only)
 * - Client: Uses window.history.pushState/replaceState
 */
export function createNavigate(
  currentPath: { (): string; (path: string): void }
): (path: string, options?: NavigateOptions) => void {
  const ssrContext = getActiveRouterContext();

  if (ssrContext) {
    // SERVER: No-op (navigation doesn't make sense on server)
    return (path: string) => {
      // Optionally update currentPath for consistency
      currentPath(path);
    };
  } else {
    // CLIENT: Use window.history API
    return (path: string, options: NavigateOptions = {}) => {
      const { replace = false } = options;

      if (replace) {
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState(null, '', path);
      }

      // Update signal
      currentPath(path);
    };
  }
}
```

---

### 4. Universal `Link` Component

**Update: `/packages/router/src/link.ts`**

```typescript
/**
 * Universal Link component with environment detection
 */

import { create } from '@lattice/lattice';
import type { RefSpec, ElRefSpecChild } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { ElementProps } from '@lattice/view/el';
import type { LinkOpts, LinkFactory } from './types';
import { getActiveRouterContext } from './ssr-context';

export const createLinkFactory = create(
  ({ el, navigate }: LinkOpts) => () => {
    const ssrContext = getActiveRouterContext();

    function Link(
      props: ElementProps<DOMRendererConfig, 'a'> & { href: string }
    ): (...children: ElRefSpecChild[]) => RefSpec<HTMLAnchorElement> {
      return (...children: ElRefSpecChild[]) => {
        const { href, onclick: userOnClick, ...restProps } = props;

        if (ssrContext) {
          // SERVER: Plain anchor tag, no interactivity
          return el('a', {
            ...restProps,
            href,
            // Preserve user's onclick but don't add navigation logic
            ...(userOnClick ? { onclick: userOnClick } : {}),
          })(...children);
        }

        // CLIENT: Add navigation handler
        const isExternal = (url: string): boolean => {
          return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
        };

        const handleClick = (event: MouseEvent): void => {
          if (userOnClick) {
            const onClick = typeof userOnClick === 'function' && userOnClick.length === 0
              ? (userOnClick as () => ((e: MouseEvent) => unknown))()
              : userOnClick as (e: MouseEvent) => unknown;
            if (onClick) onClick(event);
          }

          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button !== 0 ||
            isExternal(href)
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          navigate(href);
        };

        return el('a', {
          ...restProps,
          href,
          onclick: handleClick,
        })(...children);
      };
    }

    const extension: LinkFactory = {
      name: 'Link' as const,
      method: Link,
    };

    return extension;
  }
);
```

---

### 5. Unified Router API

**New file: `/packages/router/src/presets/universal.ts`**

```typescript
/**
 * Universal Router API
 *
 * ONE API that works in both server and client contexts.
 * Uses runtime environment detection to branch behavior.
 */

import { createApi } from '@lattice/lattice';
import type { SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';
import { defaultExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createRouteFactory } from '../route';
import { createLocationFactory } from '../location';
import { createLinkFactory } from '../link';
import { createCurrentPathSignal } from '../location';
import { createNavigate } from '../navigate';
import { getActiveRouterContext } from '../ssr-context';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '@lattice/islands/renderers/dom-server';

type SignalsApi = {
  signal: <T>(value: T) => {
    (): T;
    (value: T): void;
    peek(): T;
  };
  computed: <T>(fn: () => T) => {
    (): T;
    peek(): T;
  };
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
};

export interface UniversalRouterConfig {
  signals: SignalsApi;
}

/**
 * Create universal router API
 *
 * Automatically detects environment and configures accordingly:
 * - Server: Static rendering, no navigation
 * - Client: Full interactivity with history API
 */
export const createRouterApi = (config: UniversalRouterConfig) => {
  const { signals } = config;
  const ssrContext = getActiveRouterContext();

  // Environment-specific renderer
  const renderer = ssrContext
    ? createDOMServerRenderer()  // Server
    : createDOMRenderer();       // Client (you'd need to import this)

  const viewHelpers = createSpec(renderer, signals);
  const views = createApi(defaultExtensions<DOMServerRendererConfig>(), viewHelpers);

  // Create currentPath with environment detection
  const currentPath = createCurrentPathSignal(signals.signal);

  // Create navigate with environment detection
  const navigate = createNavigate(currentPath);

  // Set up popstate listener (client only)
  if (!ssrContext) {
    window.addEventListener('popstate', () => {
      currentPath(window.location.pathname + window.location.search + window.location.hash);
    });
  }

  // Create router context
  const routerContext = {
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
    scopedEffect: viewHelpers.scopedEffect,
    createElementScope: viewHelpers.createElementScope,
    onCleanup: viewHelpers.onCleanup,
    disposeScope: viewHelpers.disposeScope,
    getElementScope: viewHelpers.getElementScope,
    renderer,
    el: views.el,
    match: views.match,
    show: views.show,
    currentPath,
    navigate,
  };

  // Create router extensions
  const routerExtensions = createApi(
    {
      route: createRouteFactory<DOMServerRendererConfig>(),
      location: createLocationFactory(),
      Link: createLinkFactory(),
    },
    routerContext
  );

  return {
    ...signals,
    ...views,
    ...routerExtensions,
    navigate,
    currentPath,
    mount: <TElement>(spec: SealedSpec<TElement>) => spec.create(),
    create: createComponent,
  };
};

export type RouterApi = ReturnType<typeof createRouterApi>;
```

---

## Usage Examples

### Server Usage

```typescript
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createRouterApi, runWithRouterContext, createRouterContext } from '@lattice/router';

// Create router API
const signals = createSignalsApi();
const ctx = createRouterContext('/products/123');

const html = runWithRouterContext(ctx, () => {
  const router = createRouterApi({ signals });
  const { route, Link, mount } = router;

  const App = () => {
    return route('/products/:id')((params) => {
      return el('div')(
        el('h1')('Product ' + params.id),
        Link({ href: '/home' })('Go Home')  // Renders as plain <a> tag
      )();
    })();
  };

  return renderToString(mount(App()));
});
```

### Client Usage

```typescript
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createRouterApi } from '@lattice/router';

// Same API, different behavior!
const signals = createSignalsApi();
const router = createRouterApi({ signals });
const { route, Link, navigate, mount } = router;

const App = () => {
  return route('/products/:id')((params) => {
    return el('div')(
      el('h1')('Product ' + params.id),
      Link({ href: '/home' })('Go Home'),  // Adds click handler with navigate()
      el('button', {
        onclick: () => navigate('/cart')   // Programmatic navigation
      })('View Cart')
    )();
  })();
};

mount(App());
```

---

## Key Differences from Islands

| Aspect | Islands | Router |
|--------|---------|--------|
| **Detection Method** | `getActiveSSRContext()` | `getActiveRouterContext()` |
| **What's Detected** | Island registration context | Request path context |
| **Server Behavior** | Registers islands, adds metadata | Provides initial path, no-op navigation |
| **Client Behavior** | Hydrates islands from DOM | Reads window.location, manages history |
| **Context Data** | `{ islands: [], islandCounter: 0 }` | `{ initialPath: string }` |

---

## Implementation Checklist

### Phase 1: SSR Context
- [ ] Create `/packages/router/src/ssr-context.ts`
- [ ] Export `getActiveRouterContext()`, `runWithRouterContext()`, `createRouterContext()`

### Phase 2: Universal Primitives
- [ ] Update `createCurrentPathSignal()` with environment detection
- [ ] Create `createNavigate()` with environment detection
- [ ] Update `Link` component with environment detection

### Phase 3: Unified API
- [ ] Create `createRouterApi()` in `/packages/router/src/presets/universal.ts`
- [ ] Add popstate listener (client only)
- [ ] Test in both environments

### Phase 4: Exports
- [ ] Update `/packages/router/src/index.ts` to export unified API
- [ ] Remove/deprecate separate browser/server presets
- [ ] Update package.json exports if needed (optional optimization)

---

## Benefits of This Approach

1. **ONE API**: Same imports, same code, works everywhere
2. **Runtime Detection**: No build-time configuration needed
3. **Type Safety**: Shared types work in both contexts
4. **Progressive Enhancement**: Server renders static HTML, client adds interactivity
5. **Follows Islands Pattern**: Consistent with established patterns in the codebase

---

## Alternative Considered: Package.json Exports

Instead of runtime detection, could use:

```json
{
  "exports": {
    ".": {
      "browser": "./dist/browser.js",
      "default": "./dist/server.js"
    }
  }
}
```

**Why NOT chosen**:
- Requires separate implementations
- User has to import from different paths
- Harder to maintain type consistency
- Islands already shows runtime detection works well

**When to use**: As an optimization AFTER runtime detection works, to reduce client bundle size.

---

## Conclusion

The router should use **runtime environment detection via AsyncLocalStorage**, exactly like islands does. This provides:

- ONE universal API (no separate presets)
- Automatic environment branching
- Type-safe, maintainable code
- Consistency with existing patterns

The key insight: `getActiveRouterContext()` returning `undefined` vs `RouterSSRContext` is all you need to branch behavior at runtime.
