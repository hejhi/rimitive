# @lattice/adapter-memory

A lightweight, zero-dependency in-memory state adapter for Lattice. Perfect for testing, prototyping, and simple applications that don't need persistent state.

## Installation

```bash
npm install @lattice/adapter-memory
```

## Usage

```typescript
import { createModel, createComponent } from '@lattice/core';
import { createMemoryAdapter } from '@lattice/adapter-memory';

// Define your component
const counter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));

  return { model };
});

// Create an instance with the memory adapter
const { model } = counter();
const adapter = createMemoryAdapter();
const store = adapter(model);

// Use the store
console.log(store.getState().count); // 0
store.getState().increment();
console.log(store.getState().count); // 1

// Subscribe to changes
const unsubscribe = store.subscribe((state) => {
  console.log('Count changed to:', state.count);
});

store.getState().increment(); // Logs: "Count changed to: 2"
unsubscribe();
```

## API

### `createMemoryAdapter()`

Creates a new memory adapter instance.

Returns: `StateAdapter` - A function that accepts a Lattice model factory and returns a store.

### Store Interface

The store returned by the adapter has the following interface:

```typescript
interface MemoryStore<T> {
  getState: () => T;
  subscribe: (listener: (state: T) => void) => () => void;
}
```

- `getState()`: Returns the current state, including all methods defined in the model
- `subscribe(listener)`: Subscribes to state changes. Returns an unsubscribe function.

## Features

- **Zero dependencies**: No external libraries required
- **Synchronous updates**: All state changes are applied immediately
- **Full TypeScript support**: Complete type safety for your models
- **Minimal overhead**: Simple implementation for maximum performance
- **Testing friendly**: Perfect for unit tests and integration tests

## Use Cases

1. **Testing**: Ideal for testing Lattice components without external dependencies
2. **Prototyping**: Quickly prototype applications without setting up a state management library
3. **Simple apps**: For applications that don't need persistence or advanced features
4. **Learning**: Great for understanding how Lattice adapters work

## Limitations

- **No persistence**: State is lost when the application restarts
- **No devtools**: No time-travel debugging or state inspection tools
- **No middleware**: No support for logging, persistence, or other middleware
- **Single store**: Each adapter call creates an independent store instance

For production applications with these requirements, consider using adapters for Redux, Zustand, or other state management libraries.