# Lattice

Describe reactive behavior once. Use it anywhere.

## What is Lattice?

Lattice is a minimalist reactive framework that lets you describe complex behaviors as functional, composable components. Instead of coupling your business logic to a specific UI framework, you define reactive transformations that work with any state source and any view layer.

Think of Lattice components as pure functions that transform state into reactive behaviors—they don't own state or render UI, they just describe what happens.

```typescript
import { createComponent, withState } from '@lattice/core';

// Define once
const Counter = createComponent(
  withState(() => ({ count: 0 })),
  ({ store, set }) => ({
    count: store.count,
    increment: () => set(store.count, store.count() + 1),
    decrement: () => set(store.count, store.count() - 1),
    reset: () => set(store.count, 0),
  })
);

// Use anywhere
import { useComponent } from '@lattice/react';
const counter = useComponent(Counter);
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
import { createComponent, withState } from '@lattice/core';

const TodoList = createComponent(
  withState(() => ({
    todos: [],
    filter: 'all', // 'all' | 'active' | 'completed'
  })),
  ({ store, computed, set }) => {
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
        const todo = store.todos((t) => t.id === id);
        if (todo()) {
          set(todo, { ...todo(), done: !todo().done });
        }
      },

      setFilter: (filter: 'all' | 'active' | 'completed') => {
        set(store.filter, filter);
      },
    };
  }
);
```

### 2. Use in Your Framework

#### React

```tsx
import { useComponent } from '@lattice/react';

function App() {
  const todos = useComponent(TodoList);

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
import { TodoList } from './components';

const todos = useComponent(TodoList);
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
import { TodoList } from './components';

const todos = component(TodoList);
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

// Create derived signals with predicates
const activeUser = store.users((u) => u.active);
set(activeUser, { lastSeen: Date.now() }); // Partial update
// Or use update function
set(activeUser, (user) => ({ ...user, lastSeen: Date.now() }));
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
const Toggle = createComponent(
  withState(() => ({ isOpen: false })),
  ({ store, set }) => ({
    isOpen: store.isOpen,
    toggle: () => set(store.isOpen, !store.isOpen()),
  })
);

const Dropdown = createComponent(
  withState(() => ({
    isOpen: false,
    selected: null,
    items: [],
  })),
  (context) => {
    const toggle = Toggle.create(context);

    return {
      ...toggle,
      items: context.store.items,
      selected: context.store.selected,
      select: (item) => {
        set(context.store.selected, item);
        toggle.close();
      },
    };
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
