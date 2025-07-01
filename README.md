# Lattice

Pure signal-based state management that's fast, simple, and framework-agnostic.

## What is Lattice?

Lattice is a minimalist reactive state management library that uses signals for fine-grained reactivity. Define your state and logic once, use it anywhere—React, Vue, Svelte, or vanilla JS.

```typescript
import { createComponent } from '@lattice/core';

// Create reactive state
const store = createComponent({ count: 0 });

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

## Performance

Lattice is built for speed. Our benchmarks show:
- **11.27x faster** than MobX for fine-grained updates
- **5.25x faster** than MobX for large state trees (1000+ properties)
- **116,748 ops/sec** for partial state updates
- **51,478 ops/sec** for large state operations

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
import { createComponent } from '@lattice/core';

// Define your state shape
interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

// Create reactive state
const todoStore = createComponent<TodoState>({
  todos: [],
  filter: 'all',
});

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

// Batch updates for multiple signals
set(store, { count: 10, name: 'New Name' });
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

### Effects

Run side effects that automatically track dependencies:

```typescript
// Effects re-run when dependencies change
const cleanup = effect(() => {
  console.log('Count is now:', store.count());
  
  // Optional: return cleanup function
  return () => console.log('Cleaning up');
});

// Stop the effect
cleanup();
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
const toggleStore = createComponent({ isOpen: false });
const dropdownStore = createComponent({
  isOpen: false,
  selected: null,
  items: ['Option 1', 'Option 2', 'Option 3'],
});
```

## Architecture

Lattice uses a pure signal-based architecture:

- **Signals own their state** - No external stores or adapters
- **Direct updates** - `set()` writes directly to signals
- **Automatic batching** - Multiple updates in the same tick are batched
- **Fine-grained reactivity** - Only components using changed signals re-render
- **Zero dependencies** - No external state management libraries required

## Middleware

Enhance components with cross-cutting concerns:

```typescript
import { withLogger, withDevtools, withPersistence } from '@lattice/core';

// Logger middleware
const loggerConfig = withLogger({ count: 0 });
const store = createComponent(
  loggerConfig.state,
  loggerConfig.enhancer
);

// Chain multiple middleware
const config1 = withLogger({ todos: [] });
const config2 = withDevtools('TodoApp');

const enhancedStore = createComponent(
  config1.state,
  (context) => {
    context = config1.enhancer(context);
    context = config2.enhancer(context);
    return context;
  }
);
```

## Why Lattice?

- **Blazing Fast**: Up to 11x faster than other state management solutions
- **Simple**: Just signals, computed values, and effects - no complex abstractions
- **Framework Agnostic**: Same code works in React, Vue, Svelte, or vanilla JS
- **TypeScript Native**: Full type inference from state through to component usage
- **Tiny**: ~3KB core that does one thing really well
- **Composable**: Build complex behaviors from simple, testable pieces

## Examples

Check out the [examples](./examples) directory for:

- [Todo App](./examples/todo-app)
- [Data Table](./examples/data-table)
- [Form Validation](./examples/form-validation)
- [Modal System](./examples/modal)

## Documentation

- [API Reference](https://lattice.dev/docs/api)
- [Guides](https://lattice.dev/docs/guides)
- [Migration Guide](https://lattice.dev/docs/migration)

## License

MIT