# @lattice/adapter-zustand

Zustand adapter for Lattice - integrate Lattice components with Zustand state management.

## Installation

```bash
npm install @lattice/adapter-zustand zustand
```

## Basic Usage

```typescript
import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Define your component
const counter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment,
    decrement: m.decrement,
  }));

  const displaySlice = createSlice(model, (m) => ({
    value: m.count,
    label: `Count: ${m.count}`,
  }));

  return {
    model,
    actions,
    views: {
      display: displaySlice,
    },
  };
});

// Create the Zustand store
const counterStore = createZustandAdapter(counter);

// Use in vanilla JavaScript
console.log(counterStore.getState().count); // 0
counterStore.getState().increment();
console.log(counterStore.getState().count); // 1

// Subscribe to changes
const unsubscribe = counterStore.subscribe((state) => {
  console.log('Count changed:', state.count);
});

// Access views
const display = counterStore.views.display;
console.log(display.get()); // { value: 1, label: 'Count: 1' }
```

## React Integration

The adapter provides React hooks for seamless integration with React components:

```tsx
import {
  useStore,
  useModelSelector,
  useAction,
  useView,
  useActions,
} from '@lattice/adapter-zustand/react';

function Counter() {
  // Select individual state properties with proper type inference
  const count = useModelSelector(counterStore.use.count);
  
  // Get individual actions
  const increment = useAction(counterStore, 'increment');
  const decrement = useAction(counterStore, 'decrement');
  
  // Subscribe to views using selector function
  const display = useView(counterStore, views => views.display);
  
  return (
    <div>
      <h1>{display.label}</h1>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}

// Alternative: Get all actions at once
function CounterWithAllActions() {
  const count = useModelSelector(counterStore.use.count);
  const actions = useActions(counterStore);
  
  return (
    <div>
      <span>{count}</span>
      <button onClick={actions.increment}>+</button>
      <button onClick={actions.decrement}>-</button>
    </div>
  );
}

// Use custom selectors for derived state
function CounterStats() {
  const stats = useStore(counterStore, (state) => ({
    count: state.count,
    isEven: state.count % 2 === 0,
    isPositive: state.count > 0,
  }));
  
  return (
    <div>
      Count: {stats.count} 
      {stats.isEven && ' (even)'}
      {stats.isPositive && ' (positive)'}
    </div>
  );
}
```

## React Hooks API

### `useStore(store, selector?)`
Direct Zustand selector hook for accessing model state.

```tsx
// Get entire state
const state = useStore(counterStore);

// Select specific value
const count = useStore(counterStore, state => state.count);

// Compute derived values
const doubled = useStore(counterStore, state => state.count * 2);
```

### `useModelSelector(selectorHook)`
Access individual model properties with automatic subscription.

```tsx
// Direct usage with full type inference
const count = useModelSelector(counterStore.use.count);
const disabled = useModelSelector(counterStore.use.disabled);
```

The selector hook provides full type inference and automatic subscription to state changes.

### `useAction(store, key)`
Get stable action references that won't change between renders.

```tsx
const increment = useAction(counterStore, 'increment');
// increment is always the same function reference
```

### `useView(store, selector)`
Subscribe to view stores using a selector function pattern. Zustand automatically handles selector stability.

```tsx
// Basic usage
const display = useView(counterStore, views => views.display);

// Dynamic selection based on state
const [tabKey, setTabKey] = useState('tab1');
const tabView = useView(counterStore, views => views[tabKey]);

// Conditional selection
const [isLoading, setIsLoading] = useState(false);
const content = useView(
  counterStore,
  views => isLoading ? views.loading : views.content
);
```

### `useActions(store)`
Get all actions as a stable object.

```tsx
const actions = useActions(counterStore);
// actions.increment, actions.decrement, etc.
```

### `useStoreSelector(store, selector)`
Utility hook for complex selections.

```tsx
const { activeCount, completedCount } = useStoreSelector(
  todoStore,
  state => ({
    activeCount: state.todos.filter(t => !t.completed).length,
    completedCount: state.todos.filter(t => t.completed).length
  })
);
```

## Advanced Usage

### Views with select() markers

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment,
  }));

  // View that includes actions via select()
  const buttonSlice = createSlice(model, (m) => ({
    onClick: select(actions, (a) => a.increment),
    disabled: m.count >= 10,
    'aria-label': `Count: ${m.count}`,
  }));

  return {
    model,
    actions,
    views: { button: buttonSlice },
  };
});

const store = createZustandAdapter(component);

// In React
function Button() {
  const button = useView(store, views => views.button);
  
  return (
    <button 
      onClick={button.onClick}
      disabled={button.disabled}
      aria-label={button['aria-label']}
    >
      Click me
    </button>
  );
}
```

### Computed Views

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    todos: [],
    filter: 'all', // 'all' | 'active' | 'completed'
  }));

  const todoState = createSlice(model, (m) => ({
    todos: m.todos,
    filter: m.filter,
  }));

  // Computed view function
  const filteredTodosView = () =>
    todoState((state) => {
      const filtered = state.filter === 'all' 
        ? state.todos
        : state.todos.filter(t => 
            state.filter === 'active' ? !t.completed : t.completed
          );
      
      return {
        items: filtered,
        count: filtered.length,
        empty: filtered.length === 0,
      };
    });

  return {
    model,
    actions: createSlice(model, () => ({})),
    views: { filteredTodos: filteredTodosView },
  };
});

// In React
function TodoList() {
  const filteredTodos = useView(store, views => views.filteredTodos);
  
  if (filteredTodos.empty) {
    return <div>No todos</div>;
  }
  
  return (
    <ul>
      {filteredTodos.items.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

## TypeScript Support

The adapter provides full TypeScript support with automatic type inference:

```typescript
const store = createZustandAdapter(counter);

// Types are automatically inferred
const count = useModelSelector(store.use.count); // number
const { increment } = useActions(store); // increment: () => void
const display = useView(store, views => views.display); // { value: number, label: string }

// Type errors are caught
const { notExist } = useActions(store); // TS Error: Property 'notExist' does not exist
```

## Performance Considerations

1. **Action Stability**: Actions returned by `useActions` are always stable references
2. **Selective Re-renders**: `useModelSelector` only re-renders when the selected property changes
3. **View Efficiency**: Views use `useSyncExternalStore` for optimal React 18+ performance
4. **Computed Selectors**: Use `useStore` with selectors for derived state to minimize re-renders

## Comparison with Direct Zustand Usage

The Lattice adapter provides several benefits over direct Zustand usage:

1. **Compositional Architecture**: Define behavior once, use with any state management
2. **Type-Safe Views**: Views are fully typed and reactive
3. **select() Integration**: Seamlessly compose slices and actions
4. **Clean Separation**: Model, actions, and views are clearly separated
5. **Framework Agnostic Core**: Same component works with Redux, MobX, etc.

## License

MIT