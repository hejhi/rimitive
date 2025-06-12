# @lattice/adapter-store-react

Store-React adapter for Lattice - integrate Lattice components with store-react state management.

## Installation

```bash
npm install @lattice/adapter-store-react @lattice/store-react
```

## Usage

### Basic Usage

```typescript
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import type { CreateStore } from '@lattice/core';

// Define your app factory
const createApp = (createStore: CreateStore) => {
  const createSlice = createStore({ count: 0 });

  const counter = createSlice(({ get, set }) => ({
    count: () => get().count,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));

  return { counter };
};

// Create the store
const store = createStoreReactAdapter(createApp);

// Use the store
console.log(store.counter.count()); // 0
store.counter.increment();
console.log(store.counter.count()); // 1
```

### With Custom Error Handling

```typescript
const store = createStoreReactAdapter(createApp, undefined, {
  onError: (error) => {
    console.error('Store error:', error);
    // Send to error tracking service
  }
});
```

### With Store Enhancer

```typescript
// Custom enhancer that logs state changes
const loggingEnhancer = (stateCreator, createStore) => {
  return createStore((set, get) => {
    const state = stateCreator(set, get);
    console.log('Initial state:', state);
    return state;
  });
};

const store = createStoreReactAdapter(createApp, loggingEnhancer);
```

### Wrapping Existing store-react Stores

If you have an existing store-react store, you can wrap it for use with Lattice:

```typescript
import { wrapStoreReact } from '@lattice/adapter-store-react';
import { useStore } from '@lattice/store-react';

// Existing store-react store
const existingStore = useStore((set, get) => ({
  value: 0,
  increment: () => set({ value: get().value + 1 })
}));

// Wrap for Lattice
const adapter = wrapStoreReact(existingStore);
const latticeStore = createLatticeStore(myApp, adapter);
```

## Features

- **Minimal overhead**: Thin wrapper around store-react's API
- **Error isolation**: Errors in one listener don't affect others
- **Edge case handling**: Proper cleanup during unmount and subscription management
- **TypeScript support**: Full type inference from app factory to store usage
- **Enhancer pattern**: Extensible store creation for advanced use cases

## API

### `createStoreReactAdapter(appFactory, enhancer?, options?)`

Creates a Lattice store backed by store-react.

- `appFactory`: Function that creates your app structure
- `enhancer`: Optional store enhancer for customization
- `options`: Optional configuration
  - `onError`: Custom error handler for listener errors

### `wrapStoreReact(store, options?)`

Wraps an existing store-react store as a Lattice adapter.

- `store`: Existing store-react store instance
- `options`: Optional configuration

### `createStoreAdapter(options?)`

Creates a store adapter factory for custom integration scenarios.

## Differences from Zustand Adapter

While both adapters provide similar functionality, the store-react adapter:
- Is designed for component-scoped state (though can be used globally)
- Has a simpler internal structure without middleware ecosystem
- Provides the same error handling and subscription management features

## License

MIT