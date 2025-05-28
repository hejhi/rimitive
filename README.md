# Lattice

A **compositional framework** for building reusable UI behavior specifications. Lattice separates behavior definition from state management and rendering, enabling true write-once, use-anywhere components.

## Why Lattice?

Traditional component libraries couple behavior to specific frameworks and state management. Lattice introduces a new approach: define behavior as **composable specifications** that adapters can execute with any infrastructure.

```typescript
// Define behavior specification
const counter = createComponent(() => ({
  model: createModel(/* state and mutations */),
  actions: /* slice selecting methods */,
  views: /* slices or computed views */
}));

// Adapters execute it with real infrastructure
const store = createZustandAdapter(counter);  // Or Redux, MobX, etc.
const Component = createReactComponent(counter);     // Or Vue, Svelte, etc.
```

**Key insight**: Behavior patterns (selection, filtering, pagination) are universal. The infrastructure (React vs Vue, Redux vs Zustand) is an implementation detail.

## Core Concepts

### The Architecture

Lattice cleanly separates **composition** (defining behavior) from **execution** (running with real infrastructure):

1. **Composition**: Define behavior specifications as data
2. **Transformation**: Lattice transforms rich specifications to simple primitives
3. **Execution**: Adapters provide minimal primitives to execute specifications

### Core Primitive

- **`createSlice`**: The universal building block for selecting and composing state

### What Slices Create

- **Model**: The source of truth - state and mutations
- **Actions**: Slices that select methods from the model
- **Views**: Slices or functions that generate UI attributes

## A Real Example: Building a Counter

Let's start with a simple counter to understand the patterns:

```typescript
import { createComponent, createModel, createSlice } from '@lattice/core';

const counter = createComponent(() => {
  // Model: Pure state + mutations
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    disabled: false
  }));

  // Actions: Slice that selects methods
  const actions = createSlice(model, (m) => ({
    increment: m.increment,
    decrement: m.decrement
  }));

  // State slice for display
  const countSlice = createSlice(model, (m) => ({
    count: m.count
  }));
  
  // Composite slice: Combines state and actions
  const incrementButton = createSlice(model, (m) => ({
    onClick: select(actions).increment,
    disabled: m.disabled,
    'aria-label': 'Increment counter'
  }))

  return {
    model,
    actions,
    views: {
      // Computed view - needs runtime calculation
      counter: () => countSlice((state) => ({
        'data-count': state.count,
        'aria-label': `Count is ${state.count}`,
        className: state.count % 2 === 0 ? 'even' : 'odd'
      })),
      
      // Static view - slice is the view
      incrementButton
    }
  };
});
```

## Advanced Patterns

### Shared Computations

When multiple views need the same derived values, create reusable computations:

```typescript
const todoList = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    todos: [],
    filter: 'all', // 'all' | 'active' | 'completed'
    
    addTodo: (text: string) => {
      const newTodo = { id: Date.now(), text, completed: false };
      set({ todos: [...get().todos, newTodo] });
    },
    
    toggleTodo: (id: number) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      });
    },
    
    setFilter: (filter: 'all' | 'active' | 'completed') => {
      set({ filter });
    }
  }));

  // State slice for computations
  const todoState = createSlice(model, (m) => ({
    todos: m.todos,
    filter: m.filter
  }));
  
  // Shared computation - memoized automatically
  const todoStats = () => todoState((state) => {
    const active = state.todos.filter(t => !t.completed);
    const completed = state.todos.filter(t => t.completed);
    
    return {
      activeTodos: active,
      activeCount: active.length,
      completedCount: completed.length,
      hasCompleted: completed.length > 0
    };
  });
  
  // Actions slice
  const actions = createSlice(model, (m) => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    setFilter: m.setFilter
  }));

  const buttonSlice = createSlice(model, (m) => ({
    setFilter: select(actions).setFilter,
    filter: m.filter,
  }));
  
  // Composite slice factory for filter buttons
  const createFilterButtonView = (filterType: 'all' | 'active' | 'completed') => 
    () => buttonSlice((state) => ({
      onClick: state.setFilter,
      className: state.filter === filterType ? 'selected' : '',
      'aria-pressed': state.filter === filterType
    }));
  
  return {
    model,
    actions,
    views: {
      // Computed view
      summary: () => {
        const stats = todoStats();
        return {
          textContent: `${stats.activeCount} active, ${stats.completedCount} completed`
        };
      },
      
      // Parameterized slices as views
      allButton: createFilterButtonView('all'),
      activeButton: createFilterButtonView('active'),
      completedButton: createFilterButtonView('completed')
    }
  };
});
```

### Slice Composition Patterns

Slices can compose other slices for complex behaviors:

```typescript
// Base slices
const userSlice = createSlice(model, (m) => ({
  user: m.user,
}));

const themeSlice = createSlice(model, (m) => ({
  theme: m.theme,
}));

// Composite slice combining multiple slices
const headerSlice = createSlice(model, (m) => ({
  user: select(userSlice).user,
  theme: select(themeSlice).theme,
  onLogout: m.logout
}));

// Use directly as a view
views: {
  header: headerSlice
}
```

### Component Composition

Build complex behaviors from simple ones:

```typescript
// Base counter from above
const counter = createComponent(() => {
  // ... implementation
});

// Enhance with persistence
const persistentCounter = createComponent(() => {
  const base = counter();
  
  // Extend the model
  const model = createModel(({ set, get }) => ({
    // Get base state schema
    ...base.model(({ set, get })),
    
    // Add new state
    lastSaved: Date.now(),
    save: () => {
      localStorage.setItem('count', String(get().count));
      set({ lastSaved: Date.now() });
    }
  }));
  
  // Create a slice for save status
  const saveSlice = createSlice(model, (m) => ({
    lastSaved: m.lastSaved
  }));
  
  // Compute save status
  const saveStatus = () => saveSlice((state) => {
    const secondsAgo = Math.floor((Date.now() - state.lastSaved) / 1000);
    return secondsAgo > 60 ? 'unsaved changes' : 'saved';
  });
  
  return {
    model,
    actions: {
      ...base.actions,
      save: () => model.save()
    },
    views: {
      ...base.views,
      
      // New view using computed status
      saveIndicator: () => ({
        className: saveStatus() === 'unsaved changes' ? 'warning' : 'success',
        textContent: saveStatus()
      })
    }
  };
});
```

## Key Principles

### 1. **Pure State Models**
Models contain only state and mutations - no computed values:

```typescript
const model = createModel(({ set, get }) => ({
  // State
  count: 0,
  
  // Mutations
  increment: () => set({ count: get().count + 1 })
  
  // NO computed values here - that's what views/slices are for
}));
```

### 2. **Everything is a Slice**
Slices are the universal primitive - actions, views, and complex behaviors are all slices:

```typescript
// Actions are slices of methods
const actions = createSlice(model, (m) => ({
  increment: m.increment
}));

// Views are slices (or functions of slices)
const button = createSlice(model, (m) => ({
  onClick: select(actions).increment,
  disabled: m.isLoading
}));

// Compose slices from other slices
const composite = createSlice(model, (m) => ({
  action: select(actions).increment,
  state: select(button).disabled
}));
```

### 3. **Static vs Computed Views**
Views can be static slices or computed functions:

```typescript
// Static view - slice is the complete view
views: {
  button: buttonSlice  // Returns UI attributes directly
}

// Computed view - runtime calculations
views: {
  counter: () => countSlice((state) => ({
    className: state.count > 10 ? 'high' : 'low'
  }))
}
```

### 4. **Type-Safe Throughout**
TypeScript ensures contracts are satisfied at every level:

```typescript
// Type error if model doesn't provide required properties
const slice = createSlice(model, (m) => ({
  count: m.count,  // ✅ TypeScript knows this exists
  invalid: m.foo   // ❌ Type error
}));
```

## The Power of One Primitive

This approach provides:

- **Single concept** - Everything is a slice
- **Infinite composition** - Slices can compose other slices
- **Clear data flow** - Model → slices → composed slices → views
- **Maximum simplicity** - One primitive to learn, endless possibilities

---

**Core Philosophy**: UI complexity isn't about rendering. It's about behavior. Lattice lets you solve behavior once and use it everywhere.