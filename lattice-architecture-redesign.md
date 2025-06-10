# Lattice Architecture Redesign

## Overview

This document outlines a subtle redesign of Lattice's core API to achieve clean separation between serializable state and behavior. The new design eliminates the current `createModel` API in favor of a simpler pattern where `createStore` returns a factory function for creating slices.

**IMPORTANT**: This is a REWRITE, so there is NO backwards compatibility requirement. This library is unreleased, and there are NO current users.

## Core Concepts

### 1. The Store is Pure State
- Store contains only serializable state (primitives, objects, arrays)
- No functions or methods
- Store state can be persisted, sent over network, time-traveled

### 2. Store Creates Slices
- `createStore` returns a function that creates slices
- Slices are focused interfaces to the store with related functionality
- Called once during store initialization
- Natural binding between store state and slice methods

### 3. Clean Separation
- `createStore` → single source of truth + slice factory
- Slice factory → methods that operate on specific aspects of state
- Adapters only store serializable state

## Updated API Design

### Basic Example

```typescript
// Step 1: Create the store - returns a factory function for slices
const createSlice = createStore<{ count: number; name: string }>({
  count: 0,
  name: "John"
});

// Step 2: Create slices - focused interfaces to the store
const counter = createSlice(({ get, set }) => ({
  // Counter-related functionality
  count: () => get().count,
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 }),
  reset: () => set({ count: 0 }),
  isPositive: () => get().count > 0
}));

const user = createSlice(({ get, set }) => ({
  // User-related functionality
  name: () => get().name,
  setName: (name: string) => set({ name }),
  displayName: () => `User: ${get().name}`
}));

// Step 3: Return what your app needs
const createApp = () => {
  return { createSlice, counter, user };
};
```

### Organizational Patterns

The architecture doesn't prescribe how to organize slices. Here are some patterns:

```typescript
// Pattern 1: Traditional Action/View Separation (if you prefer)
const createTodoApp = () => {
  const createSlice = createStore({ todos: [], filter: 'all' });
  
  const actions = createSlice(({ get, set }) => ({
    addTodo: (text: string) => { /* ... */ },
    toggleTodo: (id: string) => { /* ... */ }
  }));
  
  const queries = createSlice(({ get }) => ({
    filteredTodos: () => { /* ... */ },
    todoCount: () => { /* ... */ }
  }));
  
  return { createSlice, actions, queries };
};

// Pattern 2: Feature-Based Organization
const createTodoApp = () => {
  const createSlice = createStore({ todos: [], filter: 'all' });
  
  const todos = createSlice(({ get, set }) => ({
    // Everything todo-related
    list: () => get().todos,
    add: (text: string) => { /* ... */ },
    toggle: (id: string) => { /* ... */ },
    remove: (id: string) => { /* ... */ }
  }));
  
  const filters = createSlice(({ get, set }) => ({
    // Everything filter-related
    current: () => get().filter,
    set: (filter) => { /* ... */ },
    filtered: () => { /* ... */ }
  }));
  
  return { createSlice, todos, filters };
};

// Pattern 3: Single Slice
const createCounter = () => {
  const createSlice = createStore({ count: 0 });
  
  const api = createSlice(({ get, set }) => ({
    // Everything in one cohesive API
    count: () => get().count,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    double: () => set({ count: get().count * 2 }),
    isPositive: () => get().count > 0
  }));
  
  return { createSlice, api };
};
```

### Slice Composition

```typescript
// Base slices that can be reused
const createSlice = createStore({ count: 0 });

const counterSlice = createSlice(({ get, set }) => ({
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 })
}));

const displaySlice = createSlice(({ get }) => ({
  displayCount: () => `Count: ${get().count}`,
  isPositive: () => get().count > 0
}));

// Simple composition by spreading (for slices without dependencies)
const enhancedCounter = createSlice((tools) => ({
  ...counterSlice(tools), // Spread in base slice methods
  double: () => tools.set({ count: tools.get().count * 2 }),
  reset: () => tools.set({ count: 0 })
}));

// Complex composition with dependencies using compose
const handlers = createSlice(
  compose(
    { counter: counterSlice, display: displaySlice },
    ({ get, set }, { counter, display }) => ({
      handleClick: () => {
        counter.increment();
        console.log(display.displayCount());
      },
      handleReset: () => {
        set({ count: 0 });
      },
      handleDouble: () => {
        set({ count: get().count * 2 });
        if (display.isPositive()) {
          console.log('Count is positive after doubling');
        }
      }
    })
  )
);
```

### Selectors with Resolve

The `resolve` function creates selectors that compute values from slices:

```typescript
// Create store and slices
const createSlice = createStore({ count: 0, multiplier: 2, label: 'Items' });

const counter = createSlice(({ get, set }) => ({
  count: () => get().count,
  doubled: () => get().count * 2,
  increment: () => set({ count: get().count + 1 })
}));

const settings = createSlice(({ get }) => ({
  multiplier: () => get().multiplier,
  label: () => get().label
}));

// Step 1: Create a selector factory with dependencies
const select = resolve({ counter, settings });

// Step 2: Use the selector factory

// Pattern 1: Direct selection - returns computed values
const computed = select(({ counter, settings }) => ({
  total: counter.count() * settings.multiplier(),
  summary: `${settings.label()}: ${counter.count()}`,
  isPositive: counter.count() > 0
}));

// Pattern 2: Parameterized selection
const createFilter = select(({ counter, settings }) => (min: number, max: number) => ({
  inRange: counter.count() >= min && counter.count() <= max,
  percentOfMax: (counter.count() / max) * 100,
  description: `Count ${counter.count()} is ${counter.count() >= min ? 'in' : 'out of'} range [${min}, ${max}]`
}));

// Pattern 3: Mixed approach
const analytics = select(({ counter, display, settings }) => ({
  // Direct computed values
  total: counter.count() * settings.multiplier(),
  average: counter.count() / settings.multiplier(),
  
  // Factory for parameterized computations
  createReport: (options: { detailed: boolean }) => ({
    summary: display.displayCount(),
    count: counter.count(),
    details: options.detailed ? {
      multiplier: settings.multiplier(),
      doubled: counter.doubled(),
      timestamp: Date.now()
    } : null
  })
}));

// Runtime treats selectors like any other factory that needs tools
// const store = createLatticeStore(createApp, adapter);
// Runtime calls computed(tools) internally
// console.log(store.computed.total); // Direct value!
```

### Key Differences: Compose vs Resolve

```typescript
// compose: Creates slices with methods that can mutate state and `get` directly from the store
// Composing slices allow for granular selection/mutations from/on the store, while selecting 
// from slices resolves them into a unit of computed state
const actions = createSlice(
  compose(
    { counter },
    ({ get, set }, { counter }) => ({
      increment: () => {  // Returns a function
        counter.increment();
        console.log('Incremented!');
      }
    })
  )
);

// resolve: Creates selectors that return computed values
const select = resolve({ counter, settings });
const values = select(({ counter, settings }) => ({
  total: counter.count() * settings.multiplier()  // Returns a value, not a function
}));
```

## Benefits of New Architecture

1. **Serializable by default** - State is always pure data
2. **Simpler mental model** - State is data, behaviors attach to state
3. **Better type inference** - State type flows naturally through the factory
4. **Safe composition** - `compose` prevents resolution timing issues
5. **Framework alignment** - Matches how Redux Toolkit, Zustand, etc. think about state
6. **Cleaner API** - Intuitive state factory pattern
7. **Extensible** - Middleware-ready architecture with consistent signatures
8. **Flexible organization** - No prescribed patterns, organize slices as needed

## Notes for Implementation

- Start with core functions first (`createStore`, `compose`, `resolve`)
- Get basic tests passing before updating adapters
- Don't worry about gradual migration
- Focus on simplicity over feature parity
- State should be JSON-serializable by design
- The old `createModel` and `createSlice` functions can be removed entirely
- The `compose` utility enables dependency injection between slices
- The `resolve` utility creates selector factories for computed values from slices
- Compose is for slices (methods), resolve is for selectors (values)
- Ensure slice factories are resolved only once during store creation
- Consider adding runtime checks to prevent `use()` during execution phase
- Slices should use methods (not getters) for consistent access patterns