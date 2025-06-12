# Lattice

A **compositional framework** for building reusable UI behavior specifications. Lattice separates behavior definition from state management and rendering, enabling true write-once, use-anywhere components.

## What is Lattice?

Lattice provides a universal abstraction layer that unifies React, Vue, and your favorite state management library. Define your behavior as **composable specifications** that adapters can execute with any infrastructure.

### The Problem

Modern applications often need to:
- Support multiple frameworks (React for web, Vue for another team, etc.)
- Migrate between state management solutions without rewriting business logic
- Share state logic between different parts of an application using different tools
- Maintain consistent patterns across diverse tech stacks

### The Solution

Behavior patterns (selection, filtering, pagination) are universal. The infrastructure (React vs Vue, Redux vs Zustand) is an implementation detail. Lattice lets you define behavior once and run it anywhere:

```typescript
// Define behavior specification once
const createComponent = (createStore) => {
  const createSlice = createStore({ count: 0 });
  
  const counter = createSlice(({ get, set }) => ({
    value: () => get().count,
    increment: () => set({ count: get().count + 1 })
  }));
  
  return { counter };
};

// Execute with any infrastructure
const store = createReduxAdapter(createComponent);      // Redux
const store = createZustandAdapter(createComponent);    // Zustand  
const store = createPiniaAdapter(createComponent);      // Pinia
const store = createStoreReactAdapter(createComponent); // react-store
```

## Core Concepts

### The Architecture

Lattice cleanly separates **composition** (defining behavior) from **execution** (running with real infrastructure):

1. **Composition**: Define behavior specifications as data structures
2. **Resolution**: Transform lazy specifications into eager, UI-ready values  
3. **Execution**: Adapters provide minimal primitives to execute specifications

### Key Components

**Slices**: Composable units that always return getter functions for lazy composition. They manage portions of your component's functionality without executing until needed.

**Adapters**: Thin bridges between Lattice and existing state management libraries (Redux, Zustand, Pinia). They handle integration details so your behavior specifications remain portable.

**Runtime**: Framework-specific hooks and utilities that work with any adapter, enabling reactive UI updates in React, Vue, and other frameworks.

**Composition**: The `compose` utility enables slices to depend on each other, building complex behaviors from simple pieces without tight coupling.

## Architecture

```
+------------------+     +--------------+     +---------------+
|   Your Component |---->|   Lattice    |---->|   Adapters    |
|  (Behavior       |     |   Core       |     |  (Redux,      |
|   Specifications)|     |              |     |   Zustand,    |
+------------------+     +--------------+     |   Pinia...)   |
                               |              +---------------+
                               |                      |
                               v                      v
                        +--------------+      +---------------+
                        |   Runtime    |      |  Framework    |
                        |  (React/Vue  |<-----|  (React/Vue)  |
                        |   Hooks)     |      |               |
                        +--------------+      +---------------+
```

## Installation

```bash
# Core
npm install @lattice/core

# Choose your adapter
npm install @lattice/adapter-redux    # For Redux
npm install @lattice/adapter-zustand   # For Zustand
npm install @lattice/adapter-pinia     # For Pinia

# Framework integration (optional)
npm install @lattice/runtime          # For React/Vue hooks
```

## Quick Start

```typescript
// 1. Define your component
import { createZustandAdapter } from '@lattice/adapter-zustand';

const createComponent = (createStore) => {
  const createSlice = createStore({ todos: [] });
  
  const todos = createSlice(({ get, set }) => ({
    items: () => get().todos,
    add: (text) => set({ todos: [...get().todos, { text, done: false }] })
  }));
  
  return { todos };
};

// 2. Create your store
const store = createZustandAdapter(createComponent);

// 3. Use in React
import { useSliceSelector } from '@lattice/runtime/react';

function TodoList() {
  const todos = useSliceSelector(store, s => s.todos.items());
  return <ul>{todos.map(todo => <li>{todo.text}</li>)}</ul>;
}
```

## Documentation

- **[Core Concepts](./packages/core/README.md)** - Deep dive into slices, composition, and architecture
- **[Adapter Guide](./packages/adapter-redux/README.md)** - How to use and create adapters
- **[Runtime Hooks](./packages/runtime/README.md)** - React and Vue integration
- **[Examples](./packages/runtime/examples)** - Sample applications and patterns

## Why Lattice?

- **Write Once, Use Everywhere**: Your business logic isn't tied to any specific state library
- **Gradual Migration**: Migrate from Redux to Zustand (or vice versa) without touching component code
- **Type Safety**: Full TypeScript support with excellent inference
- **Performance**: Minimal overhead - adapters are thin wrappers around native APIs
- **Framework Agnostic**: Same patterns work in React, Vue, and vanilla JavaScript

## Contributing

Lattice is designed to be extensible. Create adapters for your favorite state management library or contribute improvements to existing ones.

## License

MIT