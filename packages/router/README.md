# @lattice/router

Minimal client-side routing for Lattice applications.

## Status

🚧 **In Development** - API is being designed and implemented

## API

### Route Definition

```ts
import { createApi } from '@lattice/lattice';
import { createRouteFactory, createLinkFactory } from '@lattice/router';

const api = createApi({
  signal: createSignalFactory,
  computed: createComputedFactory,
  el: createElFactory,
  route: createRouteFactory,
  Link: createLinkFactory,
});

const { route, Link, mount } = api;

const routes = route('/', App)(
  route('about', About)(),
  route('products', Products)(route(':id', Product)())
);

mount(routes);
```

### Navigation with Link

The `Link` component provides declarative SPA navigation with automatic click interception:

```ts
const Nav = create((api) => () => {
  const { el, Link } = api;

  return el('nav')(
    Link({ href: '/', className: 'nav-link' })('Home'),
    Link({ href: '/about' })('About Us'),
    Link({ href: '/products/123' })('View Product')
  );
});
```

**Features:**

- Intercepts clicks for internal links (prevents full page reload)
- Allows right-click and cmd/ctrl+click for opening in new tabs
- Does not intercept external links (http://, https://)
- Accepts standard anchor attributes (className, id, etc.)
- Merges with user-provided onClick handlers
- Supports lifecycle callbacks like `el()`

## Features

- ✅ Nested route composition
- ✅ Path parameter extraction (`:id`)
- ✅ Reactive current route
- ✅ Declarative Link component for SPA navigation
- ✅ Programmatic navigation via `navigate()`
- ✅ Outlet pattern for nested routes

## Design Principles

- **Minimal**: Only client-side routing, no data loading/guards/etc.
- **Composable**: Works with existing Lattice primitives
- **Familiar**: Curried API matches `el()` pattern
- **Reactive**: Built on signals for automatic updates
