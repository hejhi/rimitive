# @lattice/router

Minimal client-side routing for Lattice applications.

## Quick Start

```typescript
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMatchModule } from '@lattice/view/match';
import { createRouterModule, Link } from '@lattice/router';

const routes = [
  { id: 'home', path: '' },
  { id: 'about', path: 'about' },
  { id: 'products', path: 'products', children: [
    { id: 'product-detail', path: ':id' }
  ]},
];

const adapter = createDOMAdapter();
const svc = compose(
  SignalModule, ComputedModule, EffectModule,
  createElModule(adapter),
  createMatchModule(adapter),
  createRouterModule(routes)
);

const { router, match, el } = svc;
```

---

## Philosophy

The router is **pure reactive state**. It provides:
- `matches` — signal of currently matched routes
- `currentPath` — signal of current URL
- `navigate()` — function to change path

It does NOT manage rendering. Use `match()` from `@lattice/view` to render based on router state.

---

## Route Configuration

Routes are plain data objects:

```typescript
const routes = [
  { id: 'home', path: '' },
  { id: 'about', path: 'about' },
  { id: 'products', path: 'products', children: [
    { id: 'product-list', path: '' },
    { id: 'product-detail', path: ':id' }
  ]},
  { id: 'user', path: 'users/:userId/posts/:postId' },
];
```

- `id` — unique identifier for the route
- `path` — path segment (without leading `/`)
- `children` — nested routes (optional)

Dynamic segments use `:param` syntax. Parameters are extracted into `params`.

---

## Using the Router

### Reactive Matches

`router.matches` is a reactive signal containing matched routes:

```typescript
const { router, match, el } = svc;

// Map route IDs to components
const pages = {
  home: () => el('div')('Home Page'),
  about: () => el('div')('About Page'),
  'product-detail': (params) => el('div')(`Product ${params.id}`),
};

// Render based on current route
const App = () =>
  match(router.matches, (matches) => {
    const route = matches[0];
    if (!route) return el('div')('404 Not Found');

    const Page = pages[route.id];
    return Page ? Page(route.params) : el('div')('Unknown route');
  });
```

### Nested Routes

For nested routes, `matches` contains the full hierarchy:

```typescript
// URL: /products/123
router.matches();
// [
//   { id: 'products', path: '/products', params: {} },
//   { id: 'product-detail', path: '/products/123', params: { id: '123' } }
// ]
```

Render nested layouts:

```typescript
const App = () =>
  match(router.matches, (matches) => {
    const [parent, child] = matches;

    if (parent?.id === 'products') {
      return ProductLayout(child);
    }

    return pages[parent?.id]?.() ?? NotFound();
  });
```

### Navigation

```typescript
// Programmatic navigation
router.navigate('/products/456');

// History navigation
router.back();
router.forward();
```

---

## Link Component

`Link` renders anchors that use the router for navigation:

```typescript
import { Link } from '@lattice/router';

// Basic link
Link({ href: '/about' })('About Us')

// With additional props
Link({ href: '/products', className: 'nav-link' })('Products')

// Dynamic href
const productId = signal('123');
Link({ href: computed(() => `/products/${productId()}`) })('View Product')
```

Links automatically:
- Intercept clicks for client-side navigation
- Allow modifier keys (Cmd/Ctrl+click opens new tab)
- Pass through external URLs unchanged

---

## Location Signals

Access URL components reactively:

```typescript
const { router } = svc;

// URL: /products?sort=price&filter=new#section-1

router.pathname();  // '/products'
router.search();    // '?sort=price&filter=new'
router.hash();      // '#section-1'
router.query();     // { sort: 'price', filter: 'new' }
```

---

## Path Matching Utilities

For custom matching logic:

```typescript
import { matchPath, matchPathPrefix, composePath } from '@lattice/router';

// Exact match
matchPath('/products/:id', '/products/123');
// { path: '/products/123', params: { id: '123' } }

// Prefix match (for parent routes)
matchPathPrefix('/products', '/products/123/details');
// { path: '/products', params: {} }

// Compose paths
composePath('/products', ':id');  // '/products/:id'
```

---

## SSR Support

Pass `initialPath` for server-side rendering:

```typescript
const svc = compose(
  ...modules,
  createRouterModule(routes, { initialPath: req.url })
);
```

The router works without `window` — it uses the provided initial path and skips browser history APIs.

---

## API

### createRouterModule(routes, options?)

Creates a router module for composition.

```typescript
createRouterModule(routes, {
  initialPath: '/',  // For SSR or testing
})
```

### createRouter(deps, routes, options?)

Creates a router instance directly (without module system):

```typescript
const router = createRouter({ signal, computed }, routes);
```

### Router

```typescript
type Router = {
  matches: Readable<MatchedRoute[]>;
  currentPath: Readable<string>;
  navigate: (path: string) => void;
  back: () => void;
  forward: () => void;
  pathname: Readable<string>;
  search: Readable<string>;
  hash: Readable<string>;
  query: Readable<Record<string, string>>;
};
```

### MatchedRoute

```typescript
type MatchedRoute = {
  id: string;                      // Route ID from config
  pattern: string;                 // Path pattern that matched
  params: Record<string, string>;  // Extracted parameters
  path: string;                    // Actual matched path
};
```

---

## License

MIT
