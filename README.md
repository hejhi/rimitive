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

### Core Primitives

- **`createSlice`**: The universal building block for selecting and composing state
- **API Parameter**: Every slice receives `(model, api)` - enabling powerful composition

### What Slices Create

- **Model**: The source of truth - state and mutations
- **Actions**: Slices that select methods from the model
- **Views**: Slices or functions that generate UI attributes

## The API Parameter

Every slice in Lattice receives two parameters: the `model` and the `api`. The API parameter provides powerful capabilities:

### Core API Methods

```typescript
interface AdapterAPI<Model> {
  // Get the current state
  getState: () => Model;
  
  // Execute another slice to get its result
  executeSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
  
  // Adapter-specific extensions...
}
```

### Basic API Usage

```typescript
// Access current state
const debugSlice = createSlice(model, (m, api) => ({
  modelValue: m.count,
  currentValue: api.getState().count,
  valuesMatch: m.count === api.getState().count
}));

// Execute other slices
const composedSlice = createSlice(model, (m, api) => {
  const userState = api.executeSlice(userSlice);
  const themeState = api.executeSlice(themeSlice);
  
  return {
    greeting: `Hello ${userState.name} (${themeState.theme} theme)`,
    preferences: {
      user: userState,
      theme: themeState
    }
  };
});

// Enhanced actions with logging
const actions = createSlice(model, (m, api) => ({
  updateWithLog: (value: string) => {
    console.log('Previous:', api.getState().value);
    m.setValue(value);
    // Note: State won't be updated until after this returns
  }
}));
```

### Why the API Parameter?

1. **State Access**: Get current state without closure dependencies
2. **Slice Composition**: Execute other slices to build complex behaviors
3. **Cross-Cutting Concerns**: Logging, metrics, debugging
4. **Adapter Extensions**: Access adapter-specific features (subscriptions, devtools, etc.)

## How It Works

Lattice Core creates **behavior specifications**, not implementations. Here's the key flow:

### 1. **You Define Specifications**
When you write Lattice code, you're creating a blueprint:
```typescript
// This doesn't execute anything - it's a specification
const actions = createSlice(model, (m, api) => ({
  increment: m.increment,
  // Use api to access current state or execute other slices
  loggedIncrement: () => {
    console.log('Current count:', api.getState().count);
    m.increment();
  }
}));

// compose() provides dependency injection for slices
const button = createSlice(
  model,
  compose(
    { actions },  // Dependencies
    (m, { actions }, api) => ({  // Selector receives model + resolved dependencies + api
      onClick: actions.increment,
      disabled: m.disabled
    })
  )
);

// Why use compose()?
// The compose pattern provides explicit dependency injection, ensuring type safety
// and making dependencies clear at the composition point.
```

### 2. **Adapters Execute Specifications**
Adapters take these specifications and make them work with real infrastructure:
```typescript
// Adapter processes the specification with actual state management
const store = createZustandAdapter(counter);  // Executes with Zustand
const Component = createReactAdapter(counter); // Renders with React
```

### 3. **Runtime Magic**
- `compose()` doesn't execute dependencies - it attaches them for later resolution
- Adapters resolve dependencies by executing slice factories with the model
- Your specifications remain pure data with no side effects

**Key insight**: Lattice Core is like writing SQL - you describe what you want, not how to get it. Adapters are like database engines that execute your queries.

### Understanding the `compose()` API

The `compose()` function provides dependency injection for slices. It takes dependencies and a selector function:

```typescript
// ✅ Correct: Use compose with dependencies
compose(
  { actions, userSlice },  // Dependencies object
  (model, { actions, userSlice }, api) => ({  // Selector receives model + resolved deps + api
    onClick: actions.increment,
    userName: userSlice.name
  })
)

// ❌ Wrong: Direct access to other slices doesn't work
actions.increment  // This won't work outside of compose!
```

**Why use compose()?**

1. **Explicit Dependencies**: All dependencies are declared upfront
2. **Type Safety**: TypeScript knows the exact shape of resolved dependencies
3. **Clean Resolution**: Adapters execute dependency slices before passing to selector
4. **No Hidden Magic**: Dependencies are visible and traceable

Remember: During composition, `compose()` attaches dependencies via `__composeDeps`. Adapters resolve these by executing each dependency slice factory with the model before calling your selector.

## A Real Example: Building a Counter

Let's build a counter step-by-step to understand the patterns:

### Step 1: Define the Specification

```typescript
import { createComponent, createModel, createSlice, compose } from '@lattice/core';

const counter = createComponent(() => {
  // Model: Pure state + mutations
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    disabled: false
  }));

  // Actions: Slice that selects methods
  const actions = createSlice(model, (m, api) => ({
    increment: m.increment,
    decrement: m.decrement,
    // Use API to log current state
    incrementWithLog: () => {
      console.log('Before:', api.getState().count);
      m.increment();
    }
  }));

  // State slice for display
  const countSlice = createSlice(model, (m, api) => ({
    count: m.count,
    // Use API to check other state
    isDisabled: api.getState().disabled
  }));
  
  // Composite slice: Combines state and actions
  const incrementButton = createSlice(
    model,
    compose(
      { actions },  // Declare dependencies
      (m, { actions }, api) => ({  // Use resolved dependencies + api
        onClick: actions.increment,
        disabled: m.disabled,
        'aria-label': 'Increment counter'
      })
    )
  )

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
  selector: composedSelector,  // The selector returned by compose()
  // composedSelector has __composeDeps property:
  // composedSelector.__composeDeps = { actions: actionsSliceFactory }
}

// The compose() function creates a selector with dependencies attached
// When called, it:
// 1. Executes each dependency slice factory with the model
// 2. Passes model + resolved dependencies to your selector
```

### Step 3: How Adapters Execute It

```typescript
// When an adapter processes your specification:
const store = createZustandAdapter(counter);

// The adapter:
// 1. Executes your model factory with Zustand's set/get
// 2. Creates actual slices that subscribe to state
// 3. Resolves compose() dependencies by executing slice factories

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
    
    // Call the action - test utils resolve compose() dependencies
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
    
    // The onClick is now a real function thanks to dependency resolution
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
  const todoState = createSlice(model, (m, api) => ({
    todos: m.todos,
    filter: m.filter,
    // Use API to derive additional state
    isEmpty: api.getState().todos.length === 0
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
  
  // Actions slice with API usage
  const actions = createSlice(model, (m, api) => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    setFilter: m.setFilter,
    // Use API to execute other slices
    clearCompleted: () => {
      const stats = api.executeSlice(todoState);
      console.log(`Clearing ${stats.todos.filter(t => t.completed).length} completed todos`);
      m.set({ todos: api.getState().todos.filter(t => !t.completed) });
    }
  }));

  const buttonSlice = createSlice(
    model,
    compose(
      { actions },  // Declare actions dependency
      (m, { actions }, api) => ({  // Receive model + resolved actions + api
        setFilter: actions.setFilter,
        filter: m.filter,
      })
    )
  );
  
  // What buttonSlice actually contains:
  // A slice factory with a composed selector that has __composeDeps = { actions }
  // At runtime, the adapter will execute the actions slice and pass the result
  
  // Composite slice factory for filter buttons
  const createFilterButtonView = (filterType: 'all' | 'active' | 'completed') => 
    () => buttonSlice((state) => ({
      onClick: state.setFilter,  // The actual function from resolved dependencies
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
// Step 1: Define base slices with API parameter
const userSlice = createSlice(model, (m, api) => ({
  user: m.user,
  isLoggedIn: m.isLoggedIn,
  // Use API to get related data
  sessionTime: Date.now() - api.getState().loginTime
}));

const themeSlice = createSlice(model, (m, api) => ({
  theme: m.theme,
  toggleTheme: m.toggleTheme,
  // Use API to check user preferences
  isSystemTheme: api.getState().theme === 'system'
}));

// Step 2: Compose slices using compose() for dependency injection
const headerSlice = createSlice(
  model,
  compose(
    { userSlice, themeSlice },  // Declare dependencies
    (m, { userSlice, themeSlice }, api) => ({  // Receive resolved slices + api
      user: userSlice.user,
      theme: themeSlice.theme,
      onLogout: m.logout  // Direct model reference
    })
  )
);

// What headerSlice specification contains:
// A slice factory with a composed selector that has:
// __composeDeps = { userSlice, themeSlice }
// The adapter will execute these dependencies before calling the selector

// Step 3: At runtime, adapters resolve these dependencies
// When adapter processes headerSlice:
// 1. Checks for __composeDeps on the selector
// 2. Executes userSlice(model) to get { user, isLoggedIn }
// 3. Executes themeSlice(model) to get { theme, toggleTheme }
// 4. Calls selector with model and resolved dependencies
// 5. Returns a working slice with all values resolved

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
  
  // The test adapter has resolved all compose() dependencies
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
  const saveSlice = createSlice(model, (m, api) => ({
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
// Actions are slices of methods with API access
const actions = createSlice(model, (m, api) => ({
  increment: m.increment,
  // Use API for enhanced functionality
  smartIncrement: () => {
    const state = api.getState();
    if (state.count < state.maxCount) {
      m.increment();
    }
  }
}));

// Views are slices (or functions of slices)
const button = createSlice(
  model,
  compose(
    { actions },  // Dependencies
    (m, { actions }, api) => ({
      onClick: actions.increment,
      disabled: m.isLoading
    })
  )
);

// Compose slices from other slices
const composite = createSlice(
  model,
  compose(
    { actions, button },  // Multiple dependencies
    (m, { actions, button }, api) => ({
      action: actions.increment,
      state: button.disabled
    })
  )
);
```

**What's Really Happening:**

```typescript
// During composition (what Lattice Core does):
compose({ actions }, (m, { actions }, api) => ({ onClick: actions.increment }))
// Returns a selector function with __composeDeps = { actions }

// During runtime (what adapters do):
// 1. Check if selector has __composeDeps property
// 2. Execute actions(model) to get { increment: [Function] }
// 3. Call selector(model, { actions: resolvedActions })
// 4. Return the result with resolved dependencies

// So at runtime, button becomes:
{
  onClick: [Function: increment],  // The actual function from actions
  disabled: false                   // The actual value from model
}
```

**Remember**: These patterns create specifications. The `compose()` function doesn't execute anything - it attaches dependencies for adapters to resolve at runtime.

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
const slice = createSlice(model, (m, api) => ({
  count: m.count,  // ✅ TypeScript knows this exists
  invalid: m.foo   // ❌ Type error
}));
```

## Understanding Specification vs Runtime

The key to understanding Lattice is the distinction between **specification time** (what you write) and **runtime** (what executes):

### Specification Time (Your Code)
```typescript
// You write specifications that describe behavior
const button = createSlice(
  model,
  compose(
    { actions },  // Dependencies declared upfront
    (m, { actions }, api) => ({
      onClick: actions.increment,  // Use resolved dependency
      disabled: m.disabled         // Direct model reference  
    })
  )
);
```

### What Gets Created
```typescript
// Lattice creates a specification object (simplified):
{
  type: 'slice',
  selector: composedSelector,  // Function with __composeDeps attached
  // composedSelector.__composeDeps = { actions: actionsSliceFactory }
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