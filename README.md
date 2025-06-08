# Lattice

A **compositional framework** for building reusable UI behavior specifications. Lattice separates behavior definition from state management and rendering, enabling true write-once, use-anywhere components.

## Why Lattice?

Traditional component libraries couple behavior to specific frameworks and state management. Lattice introduces a new approach: define behavior as **composable specifications** that adapters can execute with any infrastructure.

```typescript
// Define behavior specification
const counter = () => ({
  model: createModel(/* state and mutations */),
  actions: /* slice selecting methods */,
  views: /* slices or computed views */
});

// Adapters execute it with real infrastructure
const store = createZustandAdapter(counter);         // Or Redux, etc.
const ReactComponent = useLattice(counter);          // React hook
const vueStore = createVueAdapter(counter);         // Vue composable
```

Behavior patterns (selection, filtering, pagination) are universal. The infrastructure (React vs Vue, Redux vs Zustand) is an implementation detail.

## Core Concepts

### The Architecture

Lattice cleanly separates **composition** (defining behavior) from **execution** (running with real infrastructure):

1. **Composition**: Define behavior specifications as data
2. **Transformation**: Lattice transforms rich specifications to simple primitives
3. **Execution**: Adapters provide minimal primitives to execute specifications

### Core Primitives

- **`createModel`**: How to define the underlying state model and logic
- **`createSlice`**: The universal building block for selecting and composing state

### What Slices Create

- **Model**: The source of truth - state and mutations
- **Actions**: Slices that select methods from the model
- **Views**: Slices or functions that generate UI attributes

## Available Adapters

Lattice provides official adapters for popular frameworks and state management libraries:

### UI Framework Adapters

- **[@lattice/store-react](./packages/store-react)** - Pure React implementation with zero dependencies
  - Component-scoped stores with automatic cleanup
  - React 18+ concurrent features and automatic batching
  - Works with React Native
  
- **[@lattice/store-vue](./packages/store-vue)** - Vue 3 Composition API integration
  - Native Vue reactivity with automatic dependency tracking
  - Computed caching and fine-grained updates
  - Vue DevTools support

### State Management Adapters

- **[@lattice/adapter-zustand](./packages/adapter-zustand)** - Zustand integration
  - Global state management
  - Redux DevTools support
  - Middleware capabilities
  
- **[@lattice/adapter-redux](./packages/adapter-redux)** - Redux Toolkit integration
  - Time-travel debugging
  - Redux DevTools integration
  - Middleware ecosystem
  
- **[@lattice/adapter-pinia](./packages/adapter-pinia)** - Pinia integration for Vue
  - Vue's official state management
  - Vue DevTools integration
  - Plugin ecosystem

## Slice Composition

### Basic Composition

```typescript
// Define base slices
const userSlice = createSlice(model, (m) => ({
  name: () => m().user.name,
  email: () => m().user.email
}));

// Compose slices together using spreading
const adminSlice = createSlice(
  model,
  (m) => ({
    ...userSlice(m)
    isAdmin: () => m().isAdmin
  })
);
```

### Composition Using `compose`

```typescript
// Define base slices
const userSlice = createSlice(model, (m) => ({
  name: () => m().user.name,
  email: () => m().user.email
}));

const actions = createSlice(model, (m) => ({
  updateUser: () => m().updateUser,
  logout: () => m().logout
}));

// Compose slices together using `compose`, allowing the accessing of other slices
// through composition
const headerSlice = createSlice(
  model,
  compose(
    { userSlice, actions },  // Slice dependencies
    (m, { userSlice, actions }) => ({
      // access userSlice().name directly
      userName: () => userSlice().name,
      onLogout: () => actions().logout,
      isAdmin: () => m().user.role === 'admin'
    })
  )
);
```

### **Adapters Execute Specifications**
Adapters take your model, actions and slices, and wires them up to popular state management libraries, which generate and manage the underlying store, mutations, and selectors:
```typescript
// Adapter processes the specification with actual state management
const store = createZustandAdapter(counter);  // Executes with Zustand
const Component = createReactAdapter(counter); // Renders with React
```

---

**Core Philosophy**: UI complexity isn't about rendering. It's about behavior. Lattice lets you solve behavior once and use it everywhere.

**Remember**: Lattice Core is pure composition with no side effects. All the "magic" happens when adapters execute your specifications with real infrastructure.