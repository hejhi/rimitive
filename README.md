# Lattice

A framework that separates business logic from state management implementation, making your behavior specifications portable across any state manager or UI framework.

## The Core Problem: Architectural Lock-in

When you write business logic using Redux patterns, migrating to Zustand means rewriting everything. When your Vue team wants to share logic with your React team, you duplicate code. Every state management solution locks you into its specific patterns - Redux requires actions and reducers, Zustand uses hooks, MobX uses observables.

Lattice solves this by treating **business logic as a portable specification**, not an implementation detail.

## What Lattice Does

Lattice creates a thin abstraction layer that makes your state manager choice irrelevant to your business logic. Think of it like:
- How SQL abstracts over database implementations
- How the DOM API abstracts over browser engines
- How POSIX abstracts over operating systems

Your business logic becomes a specification that can run with any state management infrastructure:

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
const store = createStoreReactAdapter(createComponent); // store-react
```

## Key Benefits

### Minimal Overhead
Adapters are incredibly thin - they only provide `get`, `set`, and `subscribe`. There's virtually no runtime overhead compared to using the state manager directly. In many cases, state managers have _improved_ performance, due to the Lattice composition and selection model!

### Evolution Protection
The JavaScript ecosystem evolves rapidly. Lattice protects your business logic from framework churn. When the next state management solution arrives, you'll only need a new adapter.

### True Testability
Test your business logic without mocking state management internals. Since behavior is just a specification, you can verify it works correctly in isolation.

### Cross-Team Collaboration
Different teams using different frameworks can share the same business logic specifications. Your React team and Vue team can _literally_ share the same state specifications across the app, and re-compose state shapes surgically without needing to inherit or break anything.

## Real-World Use Cases

**Simple Migrations**: Gradually migrate from Redux to Zustand by changing adapters, not rewriting business logic.

**Multi-Framework Portability**: Share business logic and state between React, Vue, and other framework teams.

**Micro-Frontend Architecture**: Different micro-frontends using different state managers can share behavioral specifications.

**Library Authors**: Write state management once, ship to all frameworks with appropriate adapters; create and ship _truly headless_ components as part of your design system.

## Core Concepts

### Behavior as Specification
Instead of writing Redux actions or Zustand hooks, you write behavior specifications using simple primitives:

```typescript
const createSlice = createStore({ count: 0 });

// slice up your store any way you'd like, using Zustand-inspired patterns
const counter = createSlice(({ get, set }) => ({
  value: () => get().count,
  increment: () => set({ count: get().count + 1 })
}));
```

### Composition Without Coupling
The `compose` utility enables clean dependency injection between slices:

```typescript
const actions = createSlice(
  compose(
    { counter, user },
    ({ get, set }, { counter, user }) => ({
      incrementIfLoggedIn: () => {
        if (user.isAuthenticated()) {
          counter.increment();
        }
      }
    })
  )
);
```

### Resolution for Computed Values
The `resolve` utility creates efficient, computed values from your slices:

```typescript
const select = resolve({ counter, settings });

const computed = select(({ counter, settings }) => ({
  total: counter.value() * settings.multiplier(),
  label: `Count: ${counter.value()}`
}));
```

## Type Safety Examples

Lattice provides full TypeScript inference throughout your application:

```typescript
// Type-safe state definition
type AppState = {
  user: { id: string; name: string } | null;
  items: Array<{ id: string; price: number }>;
  settings: { theme: 'light' | 'dark' };
};

const createComponent = (createStore: CreateStore<AppState>) => {
  // TypeScript infers state shape automatically
  const createSlice = createStore({
    user: null,
    items: [],
    settings: { theme: 'light' }
  });

  // Methods are fully typed with parameter and return types
  const user = createSlice(({ get, set }) => ({
    current: () => get().user, // Return type: { id: string; name: string } | null
    login: (id: string, name: string) => set({ user: { id, name } }),
    logout: () => set({ user: null })
  }));

  // TypeScript catches errors at compile time
  const cart = createSlice(({ get, set }) => ({
    addItem: (id: string, price: number) => {
      // TypeScript knows 'items' is an array of { id: string; price: number }
      set({ items: [...get().items, { id, price }] });
    },
    // This would cause a TypeScript error:
    // set({ items: [...get().items, { id, cost: price }] }); // Error: 'cost' doesn't exist
  }));

  return { user, cart };
};

// Type inference flows through to React components
function UserProfile() {
  // TypeScript knows todos is an array of { id: string; price: number }
  const items = useSliceSelector(store, s => s.cart.items());
  
  // TypeScript knows user is { id: string; name: string } | null
  const user = useSliceSelector(store, s => s.user.current());
  
  if (!user) return <div>Please log in</div>;
  
  // TypeScript knows user is non-null here
  return <div>Welcome, {user.name}!</div>;
}
```

## Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Behavior Specs      │────▶│ Lattice Core │────▶│ Adapters        │
│ (Your Business      │     │ (Thin        │     │ (Redux,         │
│  Logic)             │     │  Abstraction)│     │  Zustand, etc)  │
└─────────────────────┘     └──────────────┘     └─────────────────┘
                                    │                      │
                                    ▼                      ▼
                            ┌──────────────┐     ┌─────────────────┐
                            │ Runtime      │◀────│ UI Framework    │
                            │ (React/Vue   │     │ (React/Vue)     │
                            │  Hooks)      │     │                 │
                            └──────────────┘     └─────────────────┘
```

## Installation

```bash
# Core
npm install @lattice/core

# Choose your adapter
npm install @lattice/adapter-redux    # For Redux
npm install @lattice/adapter-zustand   # For Zustand
npm install @lattice/adapter-pinia     # For Pinia
npm install @lattice/adapter-svelte    # For Svelte

# Framework integration (optional)
npm install @lattice/runtime          # For React/Vue/Svelte hooks
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

## Native Middleware Support

Lattice adapters are thin wrappers that preserve full compatibility with native middleware. Use your favorite tools like Redux DevTools or Zustand persist without any changes, and full type awareness:

```typescript
// Redux with DevTools
const store = createReduxAdapter(createComponent, (config) => 
  configureStore({
    ...config,
    devTools: { name: 'My App' }
  })
);

// Zustand with persist
import { persist } from 'zustand/middleware';

const store = createZustandAdapter(
  createComponent,
  (stateCreator, createStore) => 
    createStore(persist(stateCreator, { name: 'app-storage' }))
);
```

Your business logic stays portable while you keep using the middleware you already know and love.

## Documentation

- **[Core Concepts](./packages/core/README.md)** - Deep dive into slices, composition, and architecture
- **[Adapter Guide](./packages/adapter-redux/README.md)** - How to use and create adapters
- **[Runtime Hooks](./packages/runtime/README.md)** - React and Vue integration
- **[Examples](./packages/runtime/examples)** - Sample applications and patterns

## Why Lattice?

Lattice fills several gaps in the current ecosystem:

### The Portability Gap
There's no standard way to write state logic that works across different state managers. Every solution locks you into its patterns. Lattice provides that standard.

### The Evolution Protection Gap
JavaScript frameworks and libraries change rapidly. Your business logic shouldn't need to be rewritten every time you adopt a new state management solution.

### The Testing Gap
By separating specification from execution, you can test behaviors in isolation without complex mocking of state management internals.

### Technical Benefits
- **Type Safety**: Full TypeScript support with excellent inference
- **Performance**: Minimal overhead - adapters are thin wrappers around native APIs
- **Framework Agnostic**: Same patterns work in React, Vue, and vanilla JavaScript
- **Gradual Migration**: Switch state managers by changing adapters, not rewriting logic

## Contributing

Lattice is designed to be extensible. Create adapters for your favorite state management library or contribute improvements to existing ones.

## License

MIT