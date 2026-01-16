# @rimitive/resource

Reactive async data fetching. Automatic dependency tracking, cancellation, and race condition handling.

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

const products = resource((signal) =>
  fetch('/api/products', { signal }).then((r) => r.json())
);

// Full state (discriminated union)
products(); // { status: 'pending' | 'ready' | 'error', ... }

// Convenience accessors
products.loading(); // boolean
products.data(); // T | undefined
products.error(); // unknown | undefined
```

---

## Reactive Dependencies

Read signals inside the fetcher. Changes trigger automatic refetch with cancellation:

```typescript
const categoryId = signal(1);

const products = resource((signal) =>
  fetch(`/api/products?category=${categoryId()}`, { signal }).then((r) =>
    r.json()
  )
);

// Initial fetch: /api/products?category=1

categoryId(2);
// Aborts previous request, fetches /api/products?category=2
```

The fetcher receives an `AbortSignal`—pass it to `fetch()` for automatic cancellation when dependencies change or on dispose.

---

## Manual Control

```typescript
// Refetch after a mutation
await saveProduct(newProduct);
products.refetch();

// Cleanup (aborts in-flight request)
products.dispose();
```

In components, dispose via ref cleanup:

```typescript
const ProductList = () => {
  const products = resource((signal) =>
    fetch('/api/products', { signal }).then((r) => r.json())
  );

  return el('div').ref(() => () => products.dispose())();
  // ... render products
};
```

---

## Rendering

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
