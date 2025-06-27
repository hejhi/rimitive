# @lattice/adapter-store-react

Store-React adapter for Lattice - integrate Lattice components with store-react state management.

## Installation

```bash
npm install @lattice/adapter-store-react
```

## Usage

### Basic Usage

```typescript
import { createStore, storeReactAdapter } from '@lattice/adapter-store-react';
import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';

// Create a store-react compatible store
const store = createStore({ count: 0 });

// Create adapter
const adapter = storeReactAdapter(store);

// Define your component
const Counter = createComponent(
  withState<{ count: number }>(),
  ({ store, set }) => ({
    value: store.count,
    increment: () => set({ count: store.count() + 1 }),
    decrement: () => set({ count: store.count() - 1 })
  })
);

// Create component with adapter
const counter = createStoreWithAdapter(Counter, adapter);

// Use the component
console.log(counter.value()); // 0
counter.increment();
console.log(counter.value()); // 1
```

### With Custom Error Handling

```typescript
const store = createStore({ count: 0 });
const adapter = storeReactAdapter(store, {
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

const store = createStore({ count: 0 }, loggingEnhancer);
const adapter = storeReactAdapter(store);
```

### Using External store-react Stores

If you have an existing store-react compatible store from another library:

```typescript
import { storeReactAdapter } from '@lattice/adapter-store-react';

// Existing store-react compatible store
const existingStore = {
  getState: () => ({ value: 0 }),
  setState: (updates) => { /* implementation */ },
  subscribe: (listener) => { /* implementation */ },
};

// Create adapter
const adapter = storeReactAdapter(existingStore);
```

## Features

- **Minimal overhead**: Thin wrapper around store-react's API
- **Error isolation**: Errors in one listener don't affect others
- **Edge case handling**: Proper cleanup during unmount and subscription management
- **TypeScript support**: Full type inference
- **Enhancer pattern**: Extensible store creation for advanced use cases

## API

### `createStore(initialState, enhancer?)`

Creates a store-react compatible store instance.

- `initialState`: The initial state for the store
- `enhancer`: Optional store enhancer for customization

### `storeReactAdapter(store, options?)`

Creates a Lattice adapter from a store-react compatible store.

- `store`: A store instance with store-react compatible API
- `options`: Optional configuration
  - `onError`: Custom error handler for listener errors

## Differences from Zustand Adapter

While both adapters provide similar functionality, the store-react adapter:
- Includes a built-in store implementation (no separate package needed)
- Is designed for component-scoped state (though can be used globally)
- Has a simpler internal structure without middleware ecosystem
- Provides the same error handling and subscription management features

## License

MIT