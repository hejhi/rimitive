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

## How It Works

Lattice Core creates **behavior specifications**, not implementations. Here's the key flow:

### 1. **You Define Specifications**
When you write Lattice code, you're creating a blueprint:
```typescript
// This doesn't execute anything - it's a specification
const actions = createSlice(model, (m) => ({
  increment: m.increment
}));

// select() creates a marker, not an actual reference
const button = createSlice(model, (m) => ({
  onClick: select(actions).increment  // Marker for adapters to process
}));
```

### 2. **Adapters Execute Specifications**
Adapters take these specifications and make them work with real infrastructure:
```typescript
// Adapter processes the specification with actual state management
const store = createZustandAdapter(counter);  // Executes with Zustand
const Component = createReactAdapter(counter); // Renders with React
```

### 3. **Runtime Magic**
- `select()` doesn't actually access anything - it creates markers
- Adapters recognize these markers and wire up the real connections
- Your specifications remain pure data with no side effects

**Key insight**: Lattice Core is like writing SQL - you describe what you want, not how to get it. Adapters are like database engines that execute your queries.

## A Real Example: Building a Counter

Let's build a counter step-by-step to understand the patterns:

### Step 1: Define the Specification

```typescript
import { createComponent, createModel, createSlice, select } from '@lattice/core';

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
    onClick: select(actions).increment,  // Creates a marker, NOT a function call
    disabled: m.disabled,
    'aria-label': 'Increment counter'
  }))

  return {
    model,
    actions,
    views: {
      // Computed view - function that returns UI attributes
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

### Step 2: What Actually Happens

When you write the above code, here's what you're creating:

```typescript
// What incrementButton ACTUALLY contains (simplified):
{
  type: 'slice',
  dependencies: ['model'],
  selector: (m) => ({
    onClick: { 
      type: 'selection',
      source: 'actions',
      path: 'increment'
    },
    disabled: m.disabled,
    'aria-label': 'Increment counter'
  })
}

// The select(actions).increment doesn't execute anything!
// It creates this data structure for adapters to process
```

### Step 3: How Adapters Execute It

```typescript
// When an adapter processes your specification:
const store = createZustandAdapter(counter);

// The adapter:
// 1. Executes your model factory with Zustand's set/get
// 2. Creates actual slices that subscribe to state
// 3. Resolves select() markers to real function references

// What you get back is a working store:
store.actions.increment(); // Now this actually works!
console.log(store.getState().count); // 1
```

### Step 4: Testing Your Specifications

```typescript
import { createComponentTest } from '@lattice/test-utils';

describe('counter', () => {
  it('should increment count', async () => {
    // Test utilities execute your specification with a test adapter
    const test = createComponentTest(counter);
    
    // Initial state
    expect(test.store.getState().count).toBe(0);
    
    // Call the action - test utils resolve select() markers
    await test.store.actions.increment();
    
    // Verify state changed
    expect(test.store.getState().count).toBe(1);
    
    // Test computed views
    const viewAttrs = test.views.counter();
    expect(viewAttrs.className).toBe('odd');
    expect(viewAttrs['data-count']).toBe(1);
  });
  
  it('should handle button interactions', async () => {
    const test = createComponentTest(counter);
    
    // Get button view attributes
    const button = test.views.incrementButton();
    
    // The onClick is now a real function thanks to test adapter
    await button.onClick();
    
    expect(test.store.getState().count).toBe(1);
  });
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
    setFilter: select(actions).setFilter,  // Creates a selection marker
    filter: m.filter,
  }));
  
  // What buttonSlice actually contains:
  // {
  //   setFilter: { type: 'selection', source: 'actions', path: 'setFilter' },
  //   filter: <direct reference to model.filter>
  // }
  
  // Composite slice factory for filter buttons
  const createFilterButtonView = (filterType: 'all' | 'active' | 'completed') => 
    () => buttonSlice((state) => ({
      onClick: state.setFilter,  // At runtime, this is the actual function
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

Slices can compose other slices for complex behaviors. Here's how it works:

```typescript
// Step 1: Define base slices
const userSlice = createSlice(model, (m) => ({
  user: m.user,
  isLoggedIn: m.isLoggedIn
}));

const themeSlice = createSlice(model, (m) => ({
  theme: m.theme,
  toggleTheme: m.toggleTheme
}));

// Step 2: Compose slices using select()
const headerSlice = createSlice(model, (m) => ({
  user: select(userSlice).user,        // Creates a selection marker
  theme: select(themeSlice).theme,      // Another selection marker
  onLogout: m.logout                    // Direct model reference
}));

// What headerSlice specification contains:
// {
//   user: { type: 'selection', source: 'userSlice', path: 'user' },
//   theme: { type: 'selection', source: 'themeSlice', path: 'theme' },
//   onLogout: <reference to model.logout>
// }

// Step 3: At runtime, adapters resolve these markers
// When adapter processes headerSlice:
// 1. Finds userSlice in the component registry
// 2. Executes userSlice to get actual state
// 3. Resolves select(userSlice).user to the real value
// 4. Same for themeSlice
// 5. Returns a working slice with all references resolved

// Use directly as a view
views: {
  header: headerSlice
}
```

### Testing Composed Slices

```typescript
import { createComponentTest } from '@lattice/test-utils';

it('should compose slices correctly', async () => {
  const test = createComponentTest(myComponent);
  
  // The test adapter has resolved all select() markers
  const headerView = test.views.header();
  
  // These are now real values, not markers
  expect(headerView.user).toEqual({ name: 'John', id: 1 });
  expect(headerView.theme).toBe('dark');
  
  // onLogout is a real function
  await headerView.onLogout();
  expect(test.store.getState().isLoggedIn).toBe(false);
});
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
  onClick: select(actions).increment,  // Creates a specification marker
  disabled: m.isLoading
}));

// Compose slices from other slices
const composite = createSlice(model, (m) => ({
  action: select(actions).increment,   // Markers that adapters process
  state: select(button).disabled       // No actual execution happens here
}));
```

**What's Really Happening:**

```typescript
// During composition (what Lattice Core does):
select(actions).increment
// Returns: { type: 'selection', source: 'actions', path: 'increment' }

// During runtime (what adapters do):
// 1. Find the 'actions' slice in the registry
// 2. Execute it to get { increment: [Function] }
// 3. Extract the 'increment' function
// 4. Replace the marker with the actual function

// So at runtime, button becomes:
{
  onClick: [Function: increment],  // The actual function
  disabled: false                   // The actual value
}
```

**Remember**: These patterns create specifications. The `select()` function doesn't execute anything - it marks relationships for adapters to wire up at runtime.

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

## Understanding Specification vs Runtime

The key to understanding Lattice is the distinction between **specification time** (what you write) and **runtime** (what executes):

### Specification Time (Your Code)
```typescript
// You write specifications that describe behavior
const button = createSlice(model, (m) => ({
  onClick: select(actions).increment,  // Just a marker
  disabled: m.disabled                 // Just a reference
}));
```

### What Gets Created
```typescript
// Lattice creates a specification object (simplified):
{
  type: 'slice',
  selector: (m) => ({
    onClick: { type: 'selection', source: 'actions', path: 'increment' },
    disabled: m.disabled
  })
}
```

### Runtime (Adapter Execution)
```typescript
// Adapters process your specification:
const store = createZustandAdapter(component);

// Now everything is real and executable:
store.views.button().onClick();  // Calls the actual increment function
```

### Testing (Verification)
```typescript
// Test utils provide a test adapter:
const test = createComponentTest(component);

// All markers are resolved, everything works:
await test.views.button().onClick();
expect(test.store.getState().count).toBe(1);
```

## The Power of One Primitive

This approach provides:

- **Single concept** - Everything is a slice (specification)
- **Infinite composition** - Slices can compose other slices without execution
- **Clear data flow** - Model → slices → composed slices → views
- **Maximum simplicity** - One primitive to learn, endless possibilities
- **Pure specifications** - No side effects, just data describing behavior
- **Testable patterns** - Test utils verify your specifications work correctly

---

**Core Philosophy**: UI complexity isn't about rendering. It's about behavior. Lattice lets you solve behavior once and use it everywhere.

**Remember**: Lattice Core is pure composition with no side effects. All the "magic" happens when adapters execute your specifications with real infrastructure.