# @rimitive/router

Client-side routing as reactive state. The router provides signals (`matches`, `currentPath`), not rendering—use `match()` from `@rimitive/view` to render.

## Quick Start

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createElModule } from '@rimitive/view/el';
import { createMatchModule } from '@rimitive/view/match';
import { createRouterModule, Link } from '@rimitive/router';

const routes = [
  { id: 'home', path: '' },
  { id: 'about', path: 'about' },
  {
    id: 'products',
    path: 'products',
    children: [{ id: 'product-detail', path: ':id' }],
  },
];

const adapter = createDOMAdapter();

const { router, match, el } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMatchModule(adapter),
  createRouterModule(routes)
);
```

---

## Routes

Routes are plain objects with `id`, `path`, and optional `children`. Dynamic segments use `:param`:

```typescript
const routes = [
  { id: 'home', path: '' },
  { id: 'about', path: 'about' },
  {
    id: 'products',
    path: 'products',
    children: [
      { id: 'product-list', path: '' },
      { id: 'product-detail', path: ':id' },
    ],
  },
];
```

---

## Rendering

`router.matches` is a reactive signal of matched routes. Use `match()` to render:

```typescript
const pages = {
  home: () => el('div')('Home Page'),
  about: () => el('div')('About Page'),
  'product-detail': (params) => el('div')(`Product ${params.id}`),
};

const App = () =>
  match(router.matches, (matches) => {
    const route = matches[0];
    if (!route) return el('div')('404 Not Found');

    const Page = pages[route.id];
    return Page ? Page(route.params) : el('div')('Unknown route');
  });
```

For nested routes, `matches` contains the full hierarchy:

```typescript
// URL: /products/123
router.matches();
// [
//   { id: 'products', path: '/products', params: {} },
//   { id: 'product-detail', path: '/products/123', params: { id: '123' } }
// ]
```

---

## Navigation

```typescript
router.navigate('/products/456');
router.back();
router.forward();
```

---

## Link

`Link` renders anchors with client-side navigation:

```typescript
import { Link } from '@rimitive/router';

Link({ href: '/about' })('About Us');
Link({ href: '/products', className: 'nav-link' })('Products');

// Dynamic href
Link({ href: computed(() => `/products/${productId()}`) })('View Product');
```

Modifier keys (Cmd/Ctrl+click) open new tabs. External URLs pass through unchanged.

---

## Location Signals

```typescript
// URL: /products?sort=price&filter=new#section-1

router.pathname(); // '/products'
router.search();   // '?sort=price&filter=new'
router.hash();     // '#section-1'
router.query();    // { sort: 'price', filter: 'new' }
```

---

## SSR

Pass `initialPath` for server-side rendering:

```typescript
const svc = compose(
  ...modules,
  createRouterModule(routes, { initialPath: req.url })
);
```

Works without `window`—uses the provided path and skips browser history APIs.
