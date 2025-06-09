# Lattice

A **compositional framework** for building reusable UI behavior specifications. Lattice separates behavior definition from state management and rendering, enabling true write-once, use-anywhere components.

## Why Lattice?

Traditional component libraries couple behavior to specific frameworks and state management. Lattice introduces a new approach: define behavior as **composable specifications** that adapters can execute with any infrastructure.

```typescript
// Define behavior specification
const counter = () => ({
  model: createModel(/* state and mutations */),
  actions: /* slice selecting methods */,
  views: /* resolved UI-ready data */
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
2. **Resolution**: Transform lazy specifications into eager, UI-ready values
3. **Execution**: Adapters provide minimal primitives to execute specifications

### Core Primitives

- **`createModel`**: Define state shape and mutation logic
- **`createSlice`**: Create lazy state selectors that return getter functions
- **`resolve`**: Transform lazy slices into eager, UI-ready values

### The Lattice Pattern

Lattice follows a consistent pattern of separation:

- **Slices**: Always return getter functions for lazy composition
- **Actions**: Simple slices that select mutation methods (logic-less)
- **Views**: Resolved slices that return UI-ready data

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

## Building with Slices

### Creating Slices

Slices are the fundamental building block in Lattice. They always return getter functions:

```typescript
// Slices return objects with getter functions
const counterSlice = createSlice(model, (m) => ({
  count: () => m().count,
  total: () => m().total,
  increment: () => m().increment,  // Even actions are getters
  isDisabled: () => m().count >= m().limit
}));

// Slices can be nested and composed
const statsSlice = createSlice(model, (m) => ({
  average: () => m().total / m().count,
  progress: () => ({
    percentage: () => (m().count / m().limit) * 100,
    label: () => `${m().count} of ${m().limit}`
  })
}));
```

### Composing Slices

Slices can be composed without execution, maintaining lazy evaluation:

```typescript
// Basic composition using spread
const adminSlice = createSlice(model, (m) => ({
  ...userSlice(m),
  permissions: () => m().user.permissions,
  canEdit: () => m().user.role === 'admin'
}));

// Advanced composition using compose
const headerSlice = createSlice(
  model,
  compose(
    { user: userSlice, stats: statsSlice },
    (m, { user, stats }) => ({
      userName: () => user.name(),
      userRole: () => user.role(),
      statsLabel: () => stats.progress().label()
    })
  )
);
```

## Creating Actions and Views

### Actions: Logic-less Method Selection

Actions are simple slices that select mutation methods from the model:

```typescript
// Actions are direct method selectors - no logic, no getters
const actions = createSlice(model, (m) => ({
  increment: m().increment,
  decrement: m().decrement,
  setName: m().setName,
  reset: m().reset
}));
```

### Views: UI-Ready Data with `resolve`

Views transform lazy slices into eager, UI-ready values:

```typescript
// Bind slices to a model for resolution
const resolve = resolve(model, { 
  counter: counterSlice,
  stats: statsSlice 
});

// Create UI-ready views
export const counterView = resolve(
  ({ counter }) => () => ({
    value: counter.count(),              // Resolved value
    label: `Count: ${counter.count()}`,  // Resolved string
    disabled: counter.isDisabled()       // Resolved boolean
  })
);

// Create parameterized views
export const multipliedCounter = resolve(
  ({ counter }) => (multiplier: number) => ({
    value: counter.count() * multiplier,
    label: `×${multiplier}: ${counter.count()}`,
    percentage: (counter.count() * multiplier * 100) / counter.total()
  })
);
```

## Building Complete Components

Combine models, actions, and views into complete behavior specifications:

```typescript
// Define the complete counter component
const counter = () => {
  const model = createModel<{
    count: number;
    limit: number;
    increment: () => void;
    decrement: () => void;
  }>(({ set, get }) => ({
    count: 0,
    limit: 10,
    increment: () => set({ count: Math.min(get().count + 1, get().limit) }),
    decrement: () => set({ count: Math.max(get().count - 1, 0) })
  }));

  // Create base slice
  const counterSlice = createSlice(model, (m) => ({
    count: () => m().count,
    limit: () => m().limit,
    increment: () => m().increment,
    decrement: () => m().decrement,
    atLimit: () => m().count >= m().limit,
    atZero: () => m().count === 0
  }));

  // Resolve views
  const resolve = resolve(model, { counter: counterSlice });
  
  const display = resolve(
    ({ counter }) => () => ({
      value: counter.count(),
      max: counter.limit(),
      percentage: (counter.count() / counter.limit()) * 100,
      'aria-valuenow': counter.count(),
      'aria-valuemax': counter.limit()
    })
  );

  const controls = resolve(
    ({ counter }) => () => ({
      increment: {
        onClick: counter.increment(),
        disabled: counter.atLimit(),
        'aria-label': 'Increment counter'
      },
      decrement: {
        onClick: counter.decrement(),
        disabled: counter.atZero(),
        'aria-label': 'Decrement counter'
      }
    })
  );

  // Actions are simple method selectors
  const actions = createSlice(model, (m) => ({
    increment: m().increment,
    decrement: m().decrement
  }));

  return {
    model,
    actions,
    views: { display, controls }
  };
};

// Use with any adapter
const store = createZustandAdapter(counter);
store.views.display();  // { value: 0, max: 10, percentage: 0, ... }
store.actions.increment();
store.views.display();  // { value: 1, max: 10, percentage: 10, ... }
```

## Advanced Patterns

### Nested Resolution

Views can return complex nested structures:

```typescript
const dashboardView = resolve(
  ({ user, stats, settings }) => () => ({
    header: {
      title: `Welcome, ${user.name()}`,
      avatar: user.avatar(),
      menu: {
        items: user.permissions().map(p => ({
          label: p.label,
          onClick: () => navigateTo(p.route)
        }))
      }
    },
    stats: {
      daily: stats.daily(),
      weekly: stats.weekly(),
      trend: stats.trend()
    },
    preferences: {
      theme: settings.theme(),
      language: settings.language()
    }
  })
);
```

### Conditional Resolution

Views can conditionally resolve different structures:

```typescript
const userView = resolve(
  ({ user, auth }) => () => {
    if (!auth.isAuthenticated()) {
      return { 
        isGuest: true,
        loginUrl: '/login'
      };
    }
    
    return {
      isGuest: false,
      name: user.name(),
      email: user.email(),
      preferences: user.preferences()
    };
  }
);
```

---

**Core Philosophy**: UI complexity isn't about rendering. It's about behavior. Lattice lets you solve behavior once and use it everywhere.

**Remember**: Slices compose lazily, views resolve eagerly. This separation enables both performance and simplicity.