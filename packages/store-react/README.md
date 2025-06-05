# @lattice/store-react

Lightweight state store for React - create reactive stores using only React hooks, with zero external dependencies.

## Features

- 🚀 **Zero dependencies** - Uses only React's built-in hooks
- 🎯 **Component-scoped stores** - Automatic cleanup on unmount
- 🔄 **Full reactivity** - Compatible with `useViews`, `useComputedView`, and `useSubscribe`
- 📦 **Type-safe** - Full TypeScript support with type inference
- ⚛️ **React 18+ ready** - Works with concurrent features and automatic batching
- 🎨 **Fine-grained updates** - Subscribers only re-run when their selected values change
- ⚡ **Optimized performance** - Uses React 18's `startTransition` for non-blocking updates

## Installation

```bash
npm install @lattice/store-react
# or
pnpm add @lattice/store-react
```

## Basic Usage

### Using the `useLattice` hook

```tsx
import { useLattice } from '@lattice/store-react';
import { useViews } from '@lattice/runtime/react';
import { createComponent, createModel, createSlice } from '@lattice/core';

// Define your component
const counterComponent = createComponent(() => {
  const model = createModel<{
    count: number;
    increment: () => void;
    decrement: () => void;
  }>(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
  }));

  const actions = createSlice(model, m => ({
    increment: m.increment,
    decrement: m.decrement,
  }));

  const views = {
    count: createSlice(model, m => ({ value: m.count })),
  };

  return { model, actions, views };
});

// Use in your React component
function Counter() {
  const store = useLattice(counterComponent);
  const { value } = useViews(store, v => v.count());

  return (
    <div>
      <h1>Count: {value}</h1>
      <button onClick={store.actions.increment}>+</button>
      <button onClick={store.actions.decrement}>-</button>
    </div>
  );
}
```

### Using Context Provider Pattern

```tsx
import { LatticeProvider, useLatticeStore, useLattice } from '@lattice/adapter-react';
import { useViews } from '@lattice/runtime/react';

// With React adapter (component-scoped)
function App() {
  const store = useLattice(todoComponent);
  return (
    <LatticeProvider store={store}>
      <TodoList />
      <AddTodoForm />
    </LatticeProvider>
  );
}

// With any adapter
import { createZustandAdapter } from '@lattice/adapter-zustand';

function App() {
  return (
    <LatticeProvider store={createZustandAdapter(todoComponent)}>
      <TodoList />
      <AddTodoForm />
    </LatticeProvider>
  );
}

// Access the store in child components
function TodoList() {
  const store = useLatticeStore();
  const { todos } = useViews(store, v => v.todoList());

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => store.actions.toggleTodo(todo.id)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

## Key Differences from Other Adapters

### Component-Scoped Stores

Unlike Zustand or Redux adapters that create global stores, the React adapter creates stores that are scoped to your component lifecycle:

```tsx
function MyComponent() {
  // Store is created when component mounts
  const store = useLattice(myComponent);
  
  // Store is automatically cleaned up when component unmounts
  // No manual destroy() needed!
}
```

### No External Dependencies

The React adapter uses only React's built-in hooks:
- `useState` for state management
- `useRef` for stable references
- `useMemo` for performance optimization

This makes it perfect for:
- React Native projects
- Lightweight applications
- Projects with strict dependency requirements

## Advanced Patterns

### Multiple Component Instances

Each component instance gets its own isolated store:

```tsx
function TodoApp() {
  // Each list has its own independent state
  const workTodos = useLattice(todoComponent);
  const personalTodos = useLattice(todoComponent);

  return (
    <div>
      <section>
        <h2>Work</h2>
        <TodoList store={workTodos} />
      </section>
      <section>
        <h2>Personal</h2>
        <TodoList store={personalTodos} />
      </section>
    </div>
  );
}
```

### Custom Hooks

Create custom hooks for your components:

```tsx
function useTodoStore() {
  const store = useLattice(todoComponent);
  const todos = useViews(store, v => v.filteredTodos());
  const stats = useComputedView(store, v => v.statistics());

  return {
    todos,
    stats,
    actions: store.actions,
  };
}
```

## Fine-Grained Updates

The React adapter implements fine-grained updates to optimize performance. When you subscribe to specific values, the subscription callback only runs when those specific values change:

```tsx
function TodoStats() {
  const store = useLattice(todoComponent);
  
  // Only re-runs when the count changes, not when todos are reordered
  const todoCount = useViews(store, v => v.stats().count);
  
  // Only re-runs when completed status changes
  const completedCount = useViews(store, v => v.stats().completed);
  
  return (
    <div>
      <p>Total: {todoCount}</p>
      <p>Completed: {completedCount}</p>
    </div>
  );
}
```

This ensures optimal performance by preventing unnecessary re-renders when unrelated state changes.

## React Native Support

The React adapter works perfectly with React Native since it uses only React's built-in hooks. Here's a complete example:

```tsx
import React from 'react';
import { View, Text, Button, FlatList, Switch } from 'react-native';
import { useLattice } from '@lattice/store-react';
import { useViews } from '@lattice/runtime/react';
import { createComponent, createModel, createSlice } from '@lattice/core';

// Define a todo component
const todoComponent = createComponent(() => {
  const model = createModel<{
    todos: Array<{ id: string; text: string; done: boolean }>;
    addTodo: (text: string) => void;
    toggleTodo: (id: string) => void;
    clearCompleted: () => void;
  }>(({ set, get }) => ({
    todos: [],
    addTodo: (text) => {
      const newTodo = {
        id: Date.now().toString(),
        text,
        done: false,
      };
      set({ todos: [...get().todos, newTodo] });
    },
    toggleTodo: (id) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, done: !todo.done } : todo
        ),
      });
    },
    clearCompleted: () => {
      set({ todos: get().todos.filter(todo => !todo.done) });
    },
  }));

  const actions = createSlice(model, m => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    clearCompleted: m.clearCompleted,
  }));

  const views = {
    todos: createSlice(model, m => m.todos),
    stats: createSlice(model, m => ({
      total: m.todos.length,
      completed: m.todos.filter(t => t.done).length,
      hasCompleted: m.todos.some(t => t.done),
    })),
  };

  return { model, actions, views };
});

// React Native component
export function TodoApp() {
  const store = useLattice(todoComponent);
  const todos = useViews(store, v => v.todos());
  const stats = useViews(store, v => v.stats());

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        Todo List ({stats.completed}/{stats.total})
      </Text>
      
      <Button
        title="Add Todo"
        onPress={() => store.actions.addTodo(`Task ${Date.now()}`)}
      />
      
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', padding: 10 }}>
            <Switch
              value={item.done}
              onValueChange={() => store.actions.toggleTodo(item.id)}
            />
            <Text style={{
              marginLeft: 10,
              textDecorationLine: item.done ? 'line-through' : 'none'
            }}>
              {item.text}
            </Text>
          </View>
        )}
      />
      
      {stats.hasCompleted && (
        <Button
          title="Clear Completed"
          onPress={store.actions.clearCompleted}
          color="red"
        />
      )}
    </View>
  );
}
```

### React Native Navigation Example

When using React Navigation, each screen can have its own scoped store:

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

function HomeScreen() {
  // This store is scoped to HomeScreen
  const store = useLattice(homeComponent);
  // Store is automatically cleaned up when navigating away
  
  return <HomeContent store={store} />;
}

function DetailsScreen() {
  // This store is independent from HomeScreen's store
  const store = useLattice(detailsComponent);
  
  return <DetailsContent store={store} />;
}

export function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## API Reference

### `useLattice(component)`

Creates a component-scoped Lattice store using React hooks.

**Parameters:**
- `component`: A Lattice component spec or factory

**Returns:**
- `AdapterResult` with `actions`, `views`, `subscribe`, and `getState`


### `LatticeProvider`

Context provider for sharing a store across components.

**Props:**
- `store`: A Lattice store instance (from any adapter)
- `children`: React nodes

### `useLatticeStore()`

Hook to access the store from context. Must be used within a `LatticeProvider`.

**Returns:**
- The store instance from context

## When to Use This Adapter

✅ **Use when:**
- You want stores scoped to component lifecycle
- You need automatic cleanup on unmount
- You're building React Native apps
- You want zero external dependencies
- You need multiple isolated instances

❌ **Don't use when:**
- You need global state persistence
- You want Redux DevTools integration
- You need middleware capabilities
- You're migrating from Redux/Zustand

## License

MIT