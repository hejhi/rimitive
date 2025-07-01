# Lattice

Describe reactive behavior once. Use it anywhere.

## What is Lattice?

Lattice is a minimalist reactive framework that lets you describe complex behaviors as functional, composable components. Instead of coupling your business logic to a specific UI framework, you define reactive transformations that work with any state source and any view layer.

Think of Lattice components as pure functions that transform state into reactive behaviors—they don't own state or render UI, they just describe what happens.

```typescript
import { createComponent, vanillaAdapter } from '@lattice/core';

// Create an adapter (or use existing state management)
const adapter = vanillaAdapter({ count: 0 });

// Create the component context
const store = createComponent(adapter);

// Define your component logic
const Counter = ({ store, set }) => ({
  count: store.count,
  increment: () => set(store.count, store.count() + 1),
  decrement: () => set(store.count, store.count() - 1),
  reset: () => set(store.count, 0),
});

// Use in any framework
const counter = Counter(store);
```

## What Makes Lattice Different?

Most frameworks have opinions on state and rendering. Lattice doesn't care! Your components are just functions that describe reactive transformations. This means:

- **Your logic is portable**: The same `Counter` works in React, Vue, Svelte, or vanilla JS
- **State lives wherever you want**: Use Redux for global state, Zustand for auth, React context for component-scoped state in your design system, or just local component state
- **Everything composes**: Components are functions, so they compose like functions
- **No magic, just signals**: If it's reactive, it's a signal you can inspect, compose, and test

## Installation

```bash
npm install @lattice/core

# Pick your framework
npm install @lattice/react    # React 16.8+
npm install @lattice/vue      # Vue 3
npm install @lattice/svelte   # Svelte 5
```

## Quick Start

### 1. Create a Component

```typescript
import { createComponent, vanillaAdapter } from '@lattice/core';

// Define your state shape
interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

// Create an adapter with initial state
const adapter = vanillaAdapter<TodoState>({
  todos: [],
  filter: 'all',
});

// Create the component context
const todoStore = createComponent(adapter);

// Define your component logic
const TodoList = ({ store, computed, set }) => {
  const filtered = computed(() => {
    const todos = store.todos();
    const filter = store.filter();

    switch (filter) {
      case 'active':
        return todos.filter((t) => !t.done);
      case 'completed':
        return todos.filter((t) => t.done);
      default:
        return todos;
    }
  });

  return {
    todos: filtered,
    filter: store.filter,

    addTodo: (text: string) => {
      set(store.todos, [
        ...store.todos(),
        {
          id: Date.now(),
          text,
          done: false,
        },
      ]);
    },

    toggleTodo: (id: number) => {
      // Smart update: find and update specific todo
      const todoSignal = store.todos((t) => t.id === id);
      const todo = todoSignal();
      if (todo) {
        set(todoSignal, { done: !todo.done });
      }
    },

    setFilter: (filter: 'all' | 'active' | 'completed') => {
      set(store.filter, filter);
    },
  };
};
```

### 2. Use in Your Framework

#### React

```tsx
import { useComponent } from '@lattice/react';

function App() {
  // Pass the todoStore created above
  const todos = useComponent(todoStore, TodoList);

  return (
    <div>
      <input
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            todos.addTodo(e.target.value);
            e.target.value = '';
          }
        }}
      />

      {todos.todos().map((todo) => (
        <div key={todo.id} onClick={() => todos.toggleTodo(todo.id)}>
          <input type="checkbox" checked={todo.done} />
          {todo.text}
        </div>
      ))}

      <button onClick={() => todos.setFilter('all')}>All</button>
      <button onClick={() => todos.setFilter('active')}>Active</button>
      <button onClick={() => todos.setFilter('completed')}>Completed</button>
    </div>
  );
}
```

#### Vue 3

```vue
<script setup>
import { useComponent } from '@lattice/vue';
import { todoStore, TodoList } from './todos';

const todos = useComponent(todoStore, TodoList);
</script>

<template>
  <div>
    <input
      @keydown.enter="
        (e) => {
          todos.addTodo(e.target.value);
          e.target.value = '';
        }
      "
    />

    <div
      v-for="todo in todos.todos()"
      :key="todo.id"
      @click="todos.toggleTodo(todo.id)"
    >
      <input type="checkbox" :checked="todo.done" />
      {{ todo.text }}
    </div>

    <button @click="todos.setFilter('all')">All</button>
    <button @click="todos.setFilter('active')">Active</button>
    <button @click="todos.setFilter('completed')">Completed</button>
  </div>
</template>
```

#### Svelte 5

```svelte
<script>
import { component } from '@lattice/svelte';
import { todoStore, TodoList } from './todos';

const todos = component(todoStore, TodoList);
</script>

<input on:keydown={(e) => {
  if (e.key === 'Enter') {
    todos.addTodo(e.target.value);
    e.target.value = '';
  }
}} />

{#each todos.todos() as todo}
  <div on:click={() => todos.toggleTodo(todo.id)}>
    <input type="checkbox" checked={todo.done} />
    {todo.text}
  </div>
{/each}

<button on:click={() => todos.setFilter('all')}>All</button>
<button on:click={() => todos.setFilter('active')}>Active</button>
<button on:click={() => todos.setFilter('completed')}>Completed</button>
```

## Core Concepts

### Signals

Everything in Lattice is a signal - a reactive value that notifies when it changes:

```typescript
// Read signal values by calling them
const count = store.count();

// Update with set()
set(store.count, 5);
set(store.count, (n) => n + 1);

// Smart updates: create derived signals with predicates
const activeUser = store.users((u) => u.id === userId);
const todo = store.todos((t) => t.id === todoId);

// Partial updates (only specified properties change)
set(activeUser, { lastSeen: Date.now() });
set(todo, { done: true });

// Or use update function
set(activeUser, (user) => ({ ...user, lastSeen: Date.now() }));

// Use the partial helper for single property updates
import { partial } from '@lattice/core';
set(store.user, partial('name', 'Jane'));
```

### Computed Values

Derive new values that auto-update when dependencies change:

```typescript
const stats = computed(() => ({
  total: store.todos().length,
  completed: store.todos().filter((t) => t.done).length,
  remaining: store.todos().filter((t) => !t.done).length,
}));
```

### Composition

Build complex components from simple ones:

```typescript
// Simple toggle component
const Toggle = ({ store, set }) => ({
  isOpen: store.isOpen,
  toggle: () => set(store.isOpen, !store.isOpen()),
  open: () => set(store.isOpen, true),
  close: () => set(store.isOpen, false),
});

// Dropdown composes Toggle
const Dropdown = (context) => {
  // Reuse Toggle logic with the same context
  const toggle = Toggle(context);
  
  return {
    ...toggle,
    items: context.store.items,
    selected: context.store.selected,
    select: (item) => {
      context.set(context.store.selected, item);
      toggle.close();
    },
  };
};

// Create stores for components
const toggleStore = createComponent(vanillaAdapter({ isOpen: false }));
const dropdownStore = createComponent(vanillaAdapter({
  isOpen: false,
  selected: null,
  items: ['Option 1', 'Option 2', 'Option 3'],
}));
```

## Adapters

Lattice works with any state management solution through adapters:

```typescript
// Built-in vanilla adapter for simple in-memory state
import { vanillaAdapter } from '@lattice/core';

const store = createComponent(vanillaAdapter({ count: 0 }));

// Or integrate with existing state management
// Example: Redux adapter
const reduxAdapter = {
  getState: () => store.getState(),
  setState: (updates) => store.dispatch(updateAction(updates)),
  subscribe: (listener) => store.subscribe(listener),
};

// Example: Zustand adapter
const zustandAdapter = {
  getState: () => useStore.getState(),
  setState: (updates) => useStore.setState(updates),
  subscribe: (listener) => useStore.subscribe(listener),
};
```

## Middleware

Enhance components with cross-cutting concerns:

```typescript
import { withLogger, withDevtools, withPersistence } from '@lattice/core';

// Logger middleware
const store = createComponent(
  vanillaAdapter({ count: 0 }),
  withLogger({ count: 0 }).enhancer
);

// Chain multiple middleware
const enhancedStore = createComponent(
  vanillaAdapter({ todos: [] }),
  (context) => {
    context = withLogger({ todos: [] }).enhancer(context);
    context = withDevtools('TodoApp').enhancer(context);
    return context;
  }
);
```

## Examples

Check out the [examples](./examples) directory for:

- [Todo App](./examples/todo-app)
- [Data Table](./examples/data-table)
- [Form Validation](./examples/form-validation)
- [Modal System](./examples/modal)

## Why Lattice?

- **True Separation of Concerns**: Your business logic doesn't care if you use React, Vue, or Svelte
- **Reactive Everything**: Signal-based reactivity with automatic dependency tracking and fine-grained updates
- **State Freedom**: Works with Redux, Zustand, Pinia, or just plain objects—you choose where state lives
- **Ridiculously Small**: ~4KB core that does one thing really well
- **Composable by Design**: Build complex behaviors from simple, testable pieces
- **TypeScript Native**: Full type inference from state contracts through to component usage

## Documentation

- [API Reference](https://lattice.dev/docs/api)
- [Guides](https://lattice.dev/docs/guides)
- [Migration Guide](https://lattice.dev/docs/migration)

## License

MIT
