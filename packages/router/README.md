# @lattice/router

Minimal universal routing for Lattice. Reactive path matching with nested layouts, parameter extraction, and SPA navigation.

## Quick Start

```typescript
import { createDOMView } from '@lattice/view/presets/dom';
import { createRouter, connect, Link } from '@lattice/router';

const svc = createDOMView();
const router = createRouter(svc);
const { route, root } = router;

// Connected components receive route context
const AppLayout = connect(({ children }) => () => {
  const { el } = svc;
  return el('div')(
    el('nav')(Link({ href: '/' })('Home'), Link({ href: '/about' })('About')),
    el('main')(...(children ?? []))
  );
});

const Home = connect(() => () => svc.el('h1')('Welcome'));
const About = connect(() => () => svc.el('h1')('About Us'));
const NotFound = connect(() => () => svc.el('h1')('404 - Not Found'));

// Build route tree
const App = root('/', AppLayout()).create(
  route('', Home())(),
  route('about', About())(),
  route('*', NotFound())()
);

// Render with router context (enables Link navigation)
const appRef = router.renderApp(App);
document.body.appendChild(appRef.element);
```

## Core Concepts

### Connected Components

Components receive route context through `connect()`:

```typescript
const ProductPage = connect<
  DOMAdapterConfig,
  HTMLElement,
  { featured?: boolean }
>(({ params, children }) => ({ featured }) => {
  const { el, computed } = svc;

  // params is reactive - updates when URL changes
  const productId = computed(() => params().id);

  return el('div')(
    el('h1')(computed(() => `Product ${productId()}`)),
    featured && el('span')('Featured!'),
    children && el('div')(...children)
  );
});

// Use with user props
route('products/:id', ProductPage({ featured: true }))();
```

### Route Context

Connected components receive:

```typescript
type RouteContext<TConfig> = {
  children: RefSpec<TConfig['baseElement']>[] | null; // Nested routes
  params: Readable<RouteParams>; // URL parameters
};
```

### Path Patterns

```typescript
route('', Home())(); // Exact: /
route('about', About())(); // Exact: /about
route('products/:id', Product()); // Parameter: /products/123
route('*', NotFound())(); // Wildcard: catch-all
```

Parameters are extracted and available via `params`:

```typescript
// URL: /products/123?color=blue
params().id; // '123'
```

## API

### `createRouter(viewSvc, config?)`

Create a router instance bound to a view service.

```typescript
import { createRouter } from '@lattice/router';

const router = createRouter(svc, {
  initialPath: '/products', // Optional: for SSR or testing
});

const {
  root, // Define root layout
  route, // Define routes
  connect, // Connect components to route context
  navigate, // Programmatic navigation
  currentPath, // Reactive current path
  useCurrentPath, // SSR-safe current path getter
  mount, // Mount route tree from defineRoutes()
  renderApp, // Render with router context
} = router;
```

### `root(path, component)`

Define the always-rendered root layout.

```typescript
const { create, route } = root('/', AppLayout());

const App = create(route('', Home())(), route('about', About())());
```

### `route(path, component)`

Define a route with pattern matching.

```typescript
// Simple route
route('about', About())();

// Route with parameter
route('users/:id', UserProfile())();

// Nested routes
route('dashboard', DashboardLayout())(
  route('overview', Overview())(),
  route('settings', Settings())()
);

// Wildcard (catch-all)
route('*', NotFound())();
```

### `connect(wrapper)`

Connect a component to receive route context.

```typescript
const MyComponent = connect<TConfig, TElement, TUserProps>(
  (routeContext) => (userProps) => {
    // routeContext: { children, params }
    // userProps: passed when calling MyComponent({...})
    return el('div')(...);
  }
);

// Usage
route('path', MyComponent({ someProp: true }))()
```

### `Link(props)`

Declarative navigation component. Intercepts clicks for SPA navigation while preserving standard anchor behavior (right-click, modifier keys, external links).

```typescript
Link({ href: '/about' })('About Us');

Link({ href: '/products', className: 'nav-link' })('Products');

// External links work normally
Link({ href: 'https://github.com' })('GitHub');
```

### `navigate(path)`

Programmatic navigation.

```typescript
const handleSubmit = () => {
  saveData();
  router.navigate('/success');
};
```

### `currentPath`

Reactive signal containing the current URL path.

```typescript
const { computed } = svc;

const isActive = computed(() => router.currentPath().startsWith('/products'));
```

### `useCurrentPath(initialPath)`

Get a reactive current path that works in both SSR and client.

```typescript
// In a connected component
const MyComponent = connect(({ params }) => ({ ssrPath }) => {
  const path = router.useCurrentPath(ssrPath);
  // On server: returns computed wrapping ssrPath
  // On client: returns router.currentPath
});
```

## Route Trees with `defineRoutes()`

For larger apps, define routes separately from the router:

```typescript
// routes.ts
import { defineRoutes, connect } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

const AppLayout = connect<DOMAdapterConfig>(/* ... */);
const Home = connect<DOMAdapterConfig>(/* ... */);
const About = connect<DOMAdapterConfig>(/* ... */);

const { create, route } = defineRoutes<DOMAdapterConfig>('/', AppLayout());

export const appRoutes = create(route('', Home())(), route('about', About())());

// app.ts
import { appRoutes } from './routes';

const App = router.mount(appRoutes);
```

## Location Service

Reactive access to URL components:

```typescript
import { createLocationFactory } from '@lattice/router';

const locationFactory = createLocationFactory({
  computed: svc.computed,
  currentPath: router.currentPath,
});

const location = locationFactory.impl();

// All are reactive computeds
location.pathname(); // '/products/123'
location.search(); // '?sort=price'
location.hash(); // '#details'
location.query(); // { sort: 'price' }
```

## Path Matching

The router uses two matching strategies:

**Exact match** (`matchPath`): For leaf routes

```typescript
route('about', About())(); // Only matches /about
```

**Prefix match** (`matchPathPrefix`): For routes with children

```typescript
route(
  'products',
  ProductsLayout()
)(
  // Matches /products/*
  route(':id', ProductDetail())() // Exact: /products/123
);
```

Matching order:

1. Non-wildcard routes checked first (in definition order)
2. Wildcard routes checked last

## SSR Support

Router works seamlessly with `@lattice/islands`:

```typescript
// server.ts
import { createRouter } from '@lattice/router';
import { createIslandsServerApp } from '@lattice/islands/presets/islands.server';

const svc = createIslandsServerApp();
const router = createRouter(svc, {
  initialPath: req.url, // From request
});

const App = router.mount(appRoutes);
const { html, scripts } = svc.render(App);

// client.ts
const router = createRouter(svc); // Reads from window.location
const App = router.mount(appRoutes);
app.hydrate(...islands);
```

## Types

```typescript
// Route parameters
type RouteParams = Record<string, string>;

// Route match result
type RouteMatch = {
  path: string;
  params: RouteParams;
};

// Route context passed to connected components
type RouteContext<TConfig> = {
  children: RefSpec<TConfig['baseElement']>[] | null;
  params: Readable<RouteParams>;
};

// Router configuration
type RouterConfig = {
  initialPath?: string; // For SSR or testing
};

// Location service
type LocationSvc = {
  pathname: Readable<string>;
  search: Readable<string>;
  hash: Readable<string>;
  query: Readable<Record<string, string>>;
};
```

## Installation

```bash
pnpm add @lattice/router @lattice/signals @lattice/view
```

## License

MIT
