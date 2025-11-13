# @lattice/data

Data islands for server-side rendering with Lattice.

## Overview

`@lattice/data` provides a simple, type-safe way to handle server-side data fetching and client-side hydration through the **data islands** pattern. Components written once work on both server and client, with automatic serialization and hydration.

## Installation

```bash
pnpm add @lattice/data
```

## Basic Usage

```ts
import { createData } from '@lattice/data';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';

// Define a data fetcher
const withUserData = createData('user', async () => {
  return await fetchUser();
});

// Wrap your component
const Profile = withUserData((user, get) =>
  create(({ el, signal }) => () => {
    return el('div')(
      el('h1')(user.name)(),
      el('p')(user.bio)()
    )();
  })
);

// Server: fetches data, renders HTML, serializes
const html = renderToString(mount(Profile()));

// Client: rehydrates with serialized data
mount(Profile());
```

## Features

- **Write once, run everywhere**: Same component code on server and client
- **Type-safe**: Full TypeScript inference from fetcher to component props
- **Explicit data freshness**: Control when data is refetched with `get()`
- **Zero boilerplate**: Automatic serialization and hydration
- **Composable**: Stack multiple data islands with HOCs

## Documentation

See [DATA_ISLANDS_DESIGN.md](../view/src/islands/DATA_ISLANDS_DESIGN.md) for complete design documentation and patterns.

## API

### `createData(key, fetcher)`

Creates a data island HOC that fetches data on the server and hydrates on the client.

```ts
function createData<TData>(
  key: string,
  fetcher: () => Promise<TData>
): <TComponent>(
  factory: (data: TData, get: () => Promise<TData>) => TComponent
) => TComponent
```

**Parameters:**
- `key`: Unique identifier for this data island
- `fetcher`: Async function that returns the data

**Returns:**
- HOC that injects data and refetch function into component factory

### Data Registry

The global data registry manages serialization and hydration:

```ts
import { getRegistry, initializeRegistry } from '@lattice/data/registry';

// Server: serialize all fetched data
const json = getRegistry().serialize();

// Client: hydrate from serialized data
initializeRegistry(json);
```

## License

MIT
