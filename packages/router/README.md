# @lattice/router

Minimal client-side routing for Lattice applications.

## Status

🚧 **In Development** - API is being designed and implemented

## Planned API

```ts
import { createApi } from '@lattice/lattice';
import { createRouteFactory } from '@lattice/router';

const api = createApi({
  signal: createSignalFactory,
  computed: createComputedFactory,
  el: createElFactory,
  route: createRouteFactory,
});

const { route, mount } = api;

const routes = route('/', App)()(
  route('about', About)(),
  route('products', Products)()(
    route(':id', Product)()
  )
);

mount(routes);
```

## Features (Planned)

- ✅ Nested route composition
- ✅ Path parameter extraction (`:id`)
- ✅ Reactive current route
- ✅ Link interception
- ✅ Programmatic navigation
- ✅ Outlet pattern for nested routes

## Design Principles

- **Minimal**: Only client-side routing, no data loading/guards/etc.
- **Composable**: Works with existing Lattice primitives
- **Familiar**: Curried API matches `el()` pattern
- **Reactive**: Built on signals for automatic updates
