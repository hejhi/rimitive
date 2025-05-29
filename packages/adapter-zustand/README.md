# @lattice/adapter-zustand

A Zustand adapter for Lattice that enables you to use Lattice components with Zustand's powerful state management capabilities.

## Installation

```bash
npm install @lattice/adapter-zustand zustand
```

## Usage

```typescript
import { createModel, createComponent } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Define your component
const counter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));

  return { model };
});

// Create a Zustand store from your Lattice component
const { model } = counter();
const adapter = createZustandAdapter();
const useStore = adapter(model);

// Use in React components
function Counter() {
  const { count, increment, decrement } = useStore();
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

// Or use outside React
const store = useStore;
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

### `createZustandAdapter()`

Creates a new Zustand adapter instance.

Returns: `StateAdapter` - A function that accepts a Lattice model factory and returns a Zustand store.

### Store Interface

The store returned by the adapter is a standard Zustand store with all Zustand features:

```typescript
interface ZustandStore<T> extends UseBoundStore<StoreApi<T>> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  destroy: () => void;
}
```

## Features

- **Full Zustand compatibility**: Access to all Zustand features including middleware, devtools, and persistence
- **React integration**: Use hooks for efficient React rendering
- **TypeScript support**: Complete type safety for your models
- **Middleware support**: Compatible with Zustand middleware like `devtools`, `persist`, and `immer`
- **Subscriptions**: Fine-grained subscriptions with selectors
- **SSR friendly**: Works with server-side rendering

## Advanced Usage

### With Zustand Middleware

```typescript
import { devtools, persist } from 'zustand/middleware';
import { createZustandAdapter } from '@lattice/adapter-zustand';

const adapter = createZustandAdapter({
  middleware: [
    devtools({ name: 'MyApp' }),
    persist({ name: 'app-storage' })
  ]
});

const useStore = adapter(model);
```

### With Selectors

```typescript
// Use selectors for fine-grained subscriptions
function CountDisplay() {
  const count = useStore((state) => state.count);
  return <p>Count: {count}</p>;
}

// Component only re-renders when count changes
```

### Multiple Stores

```typescript
const counterAdapter = createZustandAdapter();
const todoAdapter = createZustandAdapter();

const useCounterStore = counterAdapter(counterModel);
const useTodoStore = todoAdapter(todoModel);
```

## Benefits over Memory Adapter

- **Persistence**: Use `persist` middleware for local storage
- **DevTools**: Time-travel debugging with Redux DevTools
- **React optimization**: Automatic React re-render optimization
- **Middleware ecosystem**: Large ecosystem of Zustand middleware
- **Production ready**: Battle-tested in production applications

## Migration from Memory Adapter

The API is nearly identical to the memory adapter. Key differences:

1. The returned store is a Zustand hook (can be used as both hook and store)
2. Access to Zustand middleware and devtools
3. Built-in React integration

```typescript
// Memory adapter
const store = memoryAdapter(model);
const state = store.getState();

// Zustand adapter - same API
const useStore = zustandAdapter(model);
const state = useStore.getState();

// Plus React hook usage
const state = useStore(); // In React components
```

## Best Practices

1. **Use selectors**: Leverage Zustand's selector pattern for optimal React performance
2. **Middleware composition**: Take advantage of Zustand's middleware ecosystem
3. **DevTools in development**: Use Redux DevTools for debugging
4. **Persist important state**: Use persist middleware for user preferences

## Limitations

- **React-focused**: While usable outside React, Zustand is primarily designed for React
- **Bundle size**: Larger than the memory adapter due to Zustand dependency
- **Learning curve**: Requires understanding Zustand concepts for advanced usage

For simpler use cases or testing, consider using the memory adapter. For production React applications, the Zustand adapter provides a robust solution with excellent developer experience.