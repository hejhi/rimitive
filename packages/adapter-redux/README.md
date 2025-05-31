# @lattice/adapter-redux

Redux adapter for Lattice - integrate Lattice components with Redux state management using Redux Toolkit.

## Installation

```bash
npm install @lattice/adapter-redux @reduxjs/toolkit redux
```

## Basic Usage

```typescript
import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createReduxAdapter } from '@lattice/adapter-redux';

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

// Create the Redux store
const counterStore = createReduxAdapter(counter);

// Use in vanilla JavaScript
console.log(counterStore.getState().count); // 0
counterStore.dispatch(counterStore.actions.increment());
console.log(counterStore.getState().count); // 1

// Subscribe to changes
const unsubscribe = counterStore.subscribe(() => {
  console.log('Count changed:', counterStore.getState().count);
});

// Access views
const display = counterStore.views.display();
console.log(display); // { value: 1, label: 'Count: 1' }
```

## React Integration

The adapter provides React Redux hooks for seamless integration with React components:

```tsx
import { Provider } from 'react-redux';
import {
  useSelector,
  useActions,
  useView,
} from '@lattice/adapter-redux/react';

// Wrap your app with the Redux Provider
function App() {
  return (
    <Provider store={counterStore}>
      <Counter />
    </Provider>
  );
}

function Counter() {
  // Select individual state properties
  const count = useSelector(state => state.count);
  
  // Get actions with destructuring
  const { increment, decrement } = useActions(counterStore);
  
  // Subscribe to views
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

// Alternative: Use actions object directly
function CounterWithActionsObject() {
  const count = useSelector(state => state.count);
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
  const stats = useSelector(state => ({
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

### `useSelector(selector)`
Standard React Redux selector hook for accessing model state.

```tsx
// Get entire state
const state = useSelector(state => state);

// Select specific value
const count = useSelector(state => state.count);

// Compute derived values
const doubled = useSelector(state => state.count * 2);
```

### `useView(store, selector)`
Subscribe to view stores using a selector function pattern.

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
Get all actions as a stable object. Actions can be destructured for individual use.

```tsx
// Get all actions as an object
const actions = useActions(counterStore);
// actions.increment, actions.decrement, etc.

// Or destructure for individual actions
const { increment, decrement } = useActions(counterStore);
// increment and decrement are stable function references
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

const store = createReduxAdapter(component);

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
const store = createReduxAdapter(counter);

// Types are automatically inferred
const count = useSelector<RootState, number>(state => state.count);
const { increment } = useActions(store); // increment: () => void
const display = useView(store, views => views.display); // { value: number, label: string }

// Type errors are caught
const { notExist } = useActions(store); // TS Error: Property 'notExist' does not exist
```

## Performance Considerations

1. **Action Stability**: Actions returned by `useActions` are always stable references
2. **Selective Re-renders**: Standard Redux selector behavior applies
3. **View Efficiency**: Views are memoized and only update when their dependencies change
4. **Redux DevTools**: Full support for time-travel debugging and action inspection

## Comparison with Direct Redux Usage

The Lattice adapter provides several benefits over direct Redux usage:

1. **Compositional Architecture**: Define behavior once, use with any state management
2. **Type-Safe Views**: Views are fully typed and reactive
3. **select() Integration**: Seamlessly compose slices and actions
4. **Clean Separation**: Model, actions, and views are clearly separated
5. **Reduced Boilerplate**: No need to write action types, action creators, or reducers
6. **Framework Agnostic Core**: Same component works with Zustand, MobX, etc.

## License

MIT