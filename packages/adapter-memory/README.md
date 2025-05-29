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

## Error Handling

The memory adapter implements a simple error propagation model suitable for reference implementations and testing:

### Error Propagation

- **Direct propagation**: Errors thrown in model methods are propagated directly to callers
- **No error boundaries**: The adapter does not catch or handle errors internally
- **State persistence**: State remains intact even after errors occur
- **Synchronous behavior**: All errors are thrown synchronously

### Error Context Enhancement

When errors occur, the adapter enhances them with context via `MemoryAdapterError`:

```typescript
try {
  store.getState().riskyOperation();
} catch (error) {
  // Error is wrapped with context
  console.error(error.message); // "Memory adapter error in 'riskyOperation': Original error message"
  console.error(error.methodName); // 'riskyOperation'
  console.error(error.originalError); // The original error object
}
```

### Example: Working with Errors

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    value: 0,
    riskyDivide: (divisor: number) => {
      if (divisor === 0) {
        throw new Error('Division by zero');
      }
      set({ value: get().value / divisor });
    }
  }));
  
  return { model };
});

const adapter = createMemoryAdapter();
const store = adapter(component().model);

// This will throw
try {
  store.getState().riskyDivide(0);
} catch (error) {
  // Error is caught here with added context
  // State remains unchanged
  console.log(store.getState().value); // Still 0
}

// Store continues to work normally
store.getState().riskyDivide(2); // Works fine
```

### Best Practices

1. **Handle errors at the call site**: Always wrap risky operations in try-catch blocks
2. **Validate inputs**: Perform validation in your model methods before operations
3. **Fail fast**: Throw errors early when invalid conditions are detected
4. **Use for testing**: This behavior is ideal for testing error scenarios

### Limitations

- **No error recovery**: The adapter provides no automatic error recovery mechanisms
- **No error isolation**: Errors in one method can affect the entire application flow
- **No async error handling**: Only synchronous errors are enhanced with context
- **Not production-ready**: This simple model is designed for reference and testing, not production use

For production applications requiring robust error handling, consider using adapters for state management libraries that provide error boundaries, middleware, and recovery mechanisms.

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