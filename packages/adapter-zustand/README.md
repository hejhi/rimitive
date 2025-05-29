# @lattice/adapter-zustand

A Zustand adapter for Lattice that enables you to use Lattice components with Zustand's powerful state management capabilities. The adapter returns a StateCreator function, making it feel natural for Zustand users and enabling seamless middleware composition.

## Installation

```bash
npm install @lattice/adapter-zustand zustand
```

## Usage

```typescript
import { create } from 'zustand';
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
const useStore = create(createZustandAdapter(model));

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
console.log(useStore.getState().count); // 0
useStore.getState().increment();
console.log(useStore.getState().count); // 1

// Subscribe to changes
const unsubscribe = useStore.subscribe((state) => {
  console.log('Count changed to:', state.count);
});

useStore.getState().increment(); // Logs: "Count changed to: 2"
unsubscribe();
```

## API

### `createZustandAdapter(modelFactory)`

Creates a Zustand StateCreator from a Lattice model factory. This follows Zustand's natural patterns and enables middleware composition.

**Parameters:**
- `modelFactory`: A Lattice model factory function

**Returns:** `StateCreator<T>` - A Zustand state creator function that can be passed to `create()` or composed with middleware

```typescript
import { create } from 'zustand';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Basic usage
const useStore = create(createZustandAdapter(modelFactory));

// With TypeScript
type CounterState = {
  count: number;
  increment: () => void;
  decrement: () => void;
};

const useStore = create<CounterState>(createZustandAdapter(modelFactory));
```

### Store Interface

The store created with `create()` is a standard Zustand store with all Zustand features:

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
- **Natural Zustand patterns**: Returns a StateCreator that works with `create()` and middleware
- **React integration**: Use hooks for efficient React rendering
- **TypeScript support**: Complete type safety for your models
- **Middleware support**: Compatible with all Zustand middleware like `devtools`, `persist`, and `immer`
- **Subscriptions**: Fine-grained subscriptions with selectors
- **SSR friendly**: Works with server-side rendering

## Advanced Usage

### With Zustand Middleware

The adapter returns a StateCreator, so you can compose it with any Zustand middleware using their standard patterns:

```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Single middleware
const useStore = create(
  devtools(
    createZustandAdapter(modelFactory),
    { name: 'MyApp' }
  )
);

// Multiple middleware with persist
const usePersistedStore = create(
  persist(
    createZustandAdapter(modelFactory),
    { name: 'app-storage' }
  )
);

// Complex middleware composition
const useAdvancedStore = create(
  devtools(
    persist(
      subscribeWithSelector(
        immer(
          createZustandAdapter(modelFactory)
        )
      ),
      { name: 'app-storage' }
    ),
    { name: 'MyApp' }
  )
);
```

### Middleware Composition Patterns

```typescript
// Using TypeScript's compose pattern for cleaner middleware stacking
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createZustandAdapter } from '@lattice/adapter-zustand';

const withDevtools = (name: string) => <T>(config: StateCreator<T>) =>
  devtools(config, { name });

const withPersist = (name: string) => <T>(config: StateCreator<T>) => 
  persist(config, { name });

// Clean composition
const useStore = create(
  withDevtools('MyApp')(
    withPersist('app-storage')(
      createZustandAdapter(modelFactory)
    )
  )
);

// Or with pipe utility
const pipe = (...fns: Function[]) => (x: any) => 
  fns.reduceRight((v, f) => f(v), x);

const useStore = create(
  pipe(
    createZustandAdapter,
    withPersist('app-storage'),
    withDevtools('MyApp')
  )(modelFactory)
);
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
import { create } from 'zustand';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Create multiple independent stores
const useCounterStore = create(createZustandAdapter(counterModel));
const useTodoStore = create(createZustandAdapter(todoModel));

// Or with shared middleware configuration
const createStore = <T>(modelFactory: ModelFactory<T>) => 
  create(
    devtools(
      persist(
        createZustandAdapter(modelFactory),
        { name: `${modelFactory.name}-storage` }
      )
    )
  );

const useCounterStore = createStore(counterModel);
const useTodoStore = createStore(todoModel);
```

## Benefits over Memory Adapter

- **Persistence**: Use `persist` middleware for local storage
- **DevTools**: Time-travel debugging with Redux DevTools
- **React optimization**: Automatic React re-render optimization
- **Middleware ecosystem**: Large ecosystem of Zustand middleware
- **Production ready**: Battle-tested in production applications

## Migration from Memory Adapter

The new API follows Zustand's natural patterns while maintaining compatibility:

```typescript
// Memory adapter
import { createMemoryAdapter } from '@lattice/adapter-memory';
const adapter = createMemoryAdapter();
const store = adapter(modelFactory);
const state = store.getState();

// Zustand adapter - now returns StateCreator
import { create } from 'zustand';
import { createZustandAdapter } from '@lattice/adapter-zustand';
const useStore = create(createZustandAdapter(modelFactory));
const state = useStore.getState();

// Plus React hook usage
const state = useStore(); // In React components

// Key benefit: Natural middleware composition
const useStore = create(
  devtools(
    persist(
      createZustandAdapter(modelFactory),
      { name: 'app-storage' }
    )
  )
);
```

## Real-World Example

Here's a complete example showing how natural the adapter feels in a Zustand project:

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createModel, createComponent } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Define a todo list component with Lattice
const todoList = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    todos: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',
    
    addTodo: (text: string) => {
      const todo = { id: Date.now(), text, completed: false };
      set({ todos: [...get().todos, todo] });
    },
    
    toggleTodo: (id: number) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      });
    },
    
    setFilter: (filter: 'all' | 'active' | 'completed') => set({ filter })
  }));

  return { model };
});

// Create store with Zustand patterns
const { model } = todoList();
const useTodoStore = create(
  devtools(
    persist(
      createZustandAdapter(model),
      { 
        name: 'todo-storage',
        partialize: (state) => ({ todos: state.todos }) // Only persist todos
      }
    ),
    { name: 'TodoApp' }
  )
);

// Use in React components with selectors
function TodoList() {
  const todos = useTodoStore((state) => state.todos);
  const filter = useTodoStore((state) => state.filter);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <ul>
      {filteredTodos.map(todo => (
        <li key={todo.id} onClick={() => toggleTodo(todo.id)}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}

// Shallow equality checks for performance
function TodoStats() {
  const todoCount = useTodoStore(
    (state) => state.todos.filter(t => !t.completed).length
  );
  
  return <div>Active todos: {todoCount}</div>;
}
```

## Best Practices

1. **Use selectors**: Leverage Zustand's selector pattern for optimal React performance
2. **StateCreator composition**: The adapter returns a StateCreator, enabling natural middleware composition
3. **Type inference**: Let TypeScript infer types from your model for the best developer experience
4. **Middleware order**: Apply middleware in the correct order (e.g., `immer` before `persist`)
5. **DevTools in development**: Use Redux DevTools for debugging
6. **Persist important state**: Use persist middleware for user preferences

## Limitations

- **React-focused**: While usable outside React, Zustand is primarily designed for React
- **Bundle size**: Larger than the memory adapter due to Zustand dependency
- **Learning curve**: Requires understanding Zustand concepts for advanced usage

For simpler use cases or testing, consider using the memory adapter. For production React applications, the Zustand adapter provides a robust solution with excellent developer experience.