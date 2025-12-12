# @rimitive/resource

Reactive async data fetching for Rimitive applications.

## Quick Start

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ResourceModule } from '@rimitive/resource';

const { signal, resource } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  ResourceModule
);

// Create a resource with a fetcher
const products = resource((signal) =>
  fetch('/api/products', { signal }).then((r) => r.json())
);

// Read state
products(); // { status: 'pending' | 'ready' | 'error', ... }
products.loading(); // boolean
products.data(); // T | undefined
products.error(); // unknown | undefined
```

---

## Why resource()?

Managing async state manually means juggling loading, data, and error signals. Handling race conditions when dependencies change. Remembering to abort stale requests.

`resource()` handles all of that:

- **Automatic dependency tracking** — reads signals inside the fetcher, refetches when they change
- **Automatic cancellation** — aborts in-flight requests when dependencies change or on dispose
- **Race condition handling** — ignores stale responses
- **Clean state model** — discriminated union for pending/ready/error

---

## Basic Usage

### Reading State

A resource has multiple ways to read its state:

```typescript
const items = resource<Item[]>((signal) =>
  fetch('/api/items', { signal }).then((r) => r.json())
);

// Full state object (discriminated union)
items();
// { status: 'pending' }
// { status: 'ready', value: [...] }
// { status: 'error', error: Error }

// Convenience accessors (computed signals)
items.loading(); // true | false
items.data(); // Item[] | undefined
items.error(); // unknown | undefined
```

All accessors are reactive—use them in computeds or effects.

### Reactive Dependencies

Read signals inside the fetcher. When they change, the resource refetches automatically:

```typescript
const categoryId = signal(1);

const products = resource((signal) =>
  fetch(`/api/products?category=${categoryId()}`, { signal }).then((r) =>
    r.json()
  )
);

// Initial fetch: /api/products?category=1

categoryId(2);
// Aborts previous request
// New fetch: /api/products?category=2
```

Multiple dependencies work the same way:

```typescript
const category = signal('electronics');
const sortBy = signal('price');
const page = signal(1);

const products = resource((signal) =>
  fetch(
    `/api/products?category=${category()}&sort=${sortBy()}&page=${page()}`,
    { signal }
  ).then((r) => r.json())
);

// Any change triggers a refetch
category('books'); // refetch
sortBy('rating'); // refetch
page(2); // refetch
```

### AbortSignal

The fetcher receives an `AbortSignal`. Pass it to `fetch()` for automatic cancellation:

```typescript
const products = resource((signal) =>
  fetch('/api/products', { signal }).then((r) => r.json())
);
```

When dependencies change mid-flight or `dispose()` is called, the request is aborted. Abort errors are silently ignored—they're expected behavior, not failures.

---

## Manual Control

### Refetch

Trigger a refetch programmatically:

```typescript
const products = resource((signal) =>
  fetch('/api/products', { signal }).then((r) => r.json())
);

// After a mutation, refresh the data
await saveProduct(newProduct);
products.refetch();
```

### Dispose

Clean up when the resource is no longer needed:

```typescript
const products = resource((signal) =>
  fetch('/api/products', { signal }).then((r) => r.json())
);

// Aborts in-flight request and stops tracking
products.dispose();
```

In components, dispose when the element is removed:

```typescript
const ProductList = ({ el, resource }) => {
  const products = resource((signal) =>
    fetch('/api/products', { signal }).then((r) => r.json())
  );

  return el('div').ref(() => {
    // Cleanup runs when element is removed
    return () => products.dispose();
  })();
  // ... render products
};
```

---

## Rendering Resources

Use `match()` to render different states:

```typescript
const ProductList = () =>
  match(products, (state) => {
    switch (state.status) {
      case 'pending':
        return el('div')('Loading...');
      case 'error':
        return el('div')(
          `Error: ${state.error}`,
          el('button').props({ onclick: () => products.refetch() })('Retry')
        );
      case 'ready':
        return el('ul')(
          map(
            state.value,
            (p) => p.id,
            (product) => el('li')(computed(() => product().name))
          )
        );
    }
  });
```

Or use convenience accessors for simpler cases:

```typescript
const ProductList = () =>
  el('div')(
    match(products.loading, (loading) =>
      loading ? el('div')('Loading...') : null
    ),
    match(products.error, (err) => (err ? el('div')(`Error: ${err}`) : null)),
    match(products.data, (data) =>
      data
        ? el('ul')(
            map(
              data,
              (p) => p.id,
              (product) => el('li')(computed(() => product().name))
            )
          )
        : null
    )
  );
```

---

## Types

```typescript
import type { Resource, ResourceState, Fetcher } from '@rimitive/resource';

// ResourceState<T> - discriminated union
type ResourceState<T> =
  | { status: 'pending' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: unknown };

// Resource<T> - the resource API
type Resource<T> = {
  (): ResourceState<T>;
  loading: () => boolean;
  data: () => T | undefined;
  error: () => unknown;
  refetch: () => void;
  dispose: () => void;
};

// Fetcher<T> - the fetcher function
type Fetcher<T> = (signal: AbortSignal) => Promise<T>;
```

---

## Import Guide

| Use Case           | Import                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Module composition | `import { ResourceModule } from '@rimitive/resource'`                        |
| Factory (advanced) | `import { createResourceFactory } from '@rimitive/resource'`                 |
| Types only         | `import type { Resource, ResourceState, Fetcher } from '@rimitive/resource'` |

---

## Advanced: Custom Wiring

For custom compositions, use the factory function directly:

```typescript
import { createResourceFactory } from '@rimitive/resource';

const resource = createResourceFactory({
  signal: mySignalFactory,
  computed: myComputedFactory,
  effect: myEffectFactory,
});
```

---

## Related

- **`@rimitive/view/load`** — async loading boundaries with Suspense-like UI patterns
- **Signal Patterns: Async Actions** — for mutations (POST, PUT, DELETE) that need loading/error state but don't refetch on dependency changes

---

## License

MIT
