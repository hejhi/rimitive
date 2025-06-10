# Lattice Architecture Redesign

## Overview

This document outlines a subtle redesign of Lattice's core API to achieve clean separation between serializable state and behavior. The new design eliminates the current `createModel` API in favor of a simpler `createState` + `createSlice` pattern.

**IMPORTANT**: This is a REWRITE, so there is NO backwards compatibility requirement. This library is unreleased, and there are NO current users.

## Core Concepts

### 1. State is Pure Data
- State contains only serializable values (primitives, objects, arrays)
- No functions or methods in state
- State can be persisted, sent over network, time-traveled

### 2. Slices are Behavior Factories  
- Slices are functions that create method objects
- Called once during store initialization
- Methods closure over state tools (get/set)
- Slices are composable

### 3. Clean Separation
- `createState` → pure data
- `createSlice` → methods that operate on data
- Adapters only store serializable state

## Updated API Design

### Basic Example

```typescript
// `createModel` becomes `createState`
// Step 1: Define pure, serializable state
const state = createState<{ count: number; name: string }>({
  count: 0,
  name: "John"
});

// `createSlice` remains the same, but gets the `getState` AND `setState` as well now
// (actions and views are slowly becoming just a potential pattern and not a first-class api)
// Step 2: Create action slice (methods that mutate state)
const actions = createSlice(state, ({ get, set }) => ({
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 }),
  reset: () => set({ count: 0 }),
  setName: (name: string) => set({ name })
}));

// Step 3: Create view slice (computed/derived values)
const views = createSlice(state, ({ get }) => ({
  displayCount: () => `Count: ${get().count}`,
  isPositive: () => get().count > 0,
  isNegative: () => get().count < 0
}));

// Step 4: Component composition
const counter = () => {
  return { state, actions, views };
};
```

### Slice Composition

```typescript
// Base slice that can be reused
const counterSlice = createSlice(state, ({ get, set }) => ({
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 })
}));

// Compose slices together (similar to today, but we pass `tools` now)
const enhancedActions = createSlice(state, (tools) => ({
  ...counterSlice(tools), // Spread in base slice
  double: () => tools.set({ count: tools.get().count * 2 }),
  reset: () => tools.set({ count: 0 })
}));

// Slices can reference other slices, which removes the need for `compose`
const handlers = createSlice(state, (tools) => {
  const actions = counterSlice(tools);
  const views = viewSlice(tools);
  
  return {
    handleClick: () => {
      actions.increment();
      console.log(views.displayCount());
    },
    handleReset: () => {
      tools.set({ count: 0 });
    }
  };
});
```

## Implementation Steps

### Step 1: Core Types

Create new type definitions in `packages/core/src/index.ts`:

```typescript
// State factory - returns a state descriptor
export type StateFactory<T> = T;

// Tools provided to slices
export interface SliceTools<T> {
  get: () => T;
  set: (updates: Partial<T>) => void;
}

// Slice factory - takes tools and returns methods
export type SliceFactory<State, Methods> = (
  tools: SliceTools<State>
) => Methods;

// Component spec with separated state and slices
export interface ComponentSpec<State, Actions, Views> {
  state: StateFactory<State>;
  actions: SliceFactory<State, Actions>;
  views: SliceFactory<State, Views>;
}
```

### Step 2: Core Functions

Replace existing `createModel` with new functions:

```typescript
// Creates a state descriptor
export function createState<T>(initialState: T): StateFactory<T> {
  return initialState;
}

// Creates a slice factory
export function createSlice<State, Methods>(
  state: StateFactory<State>,
  factory: (tools: SliceTools<State>) => Methods
): SliceFactory<State, Methods> {
  return factory;
}
```

### Step 3: Runtime Updates

Update `packages/core/src/runtime.ts`:

```typescript
export function createLatticeStore<State, Actions, Views>(
  componentFactory: ComponentFactory<State, Actions, Views>,
  adapter: StoreAdapter<State>
) {
  const component = componentFactory();
  
  // Initialize pure state (no methods)
  const initialState = component.state;
  adapter.setState(initialState);
  
  // Create tools for slices
  const tools: SliceTools<State> = {
    get: adapter.getState,
    set: adapter.setState
  };
  
  // Execute slices to get methods
  const actions = component.actions(tools);
  const views = component.views(tools);
  
  return {
    actions,
    views,
    subscribe: adapter.subscribe,
    getState: adapter.getState, // Returns only serializable state
  };
}
```

### Step 4: Update All Adapters

Since state is now pure data, adapters become simpler:

```typescript
// Zustand adapter - no changes needed, already handles objects
export function createZustandAdapter<State, Actions, Views>(
  componentFactory: ComponentFactory<State, Actions, Views>
) {
  return createLatticeStore(componentFactory, createStoreAdapter<State>());
}

// Pinia adapter - remove Record<string, unknown> constraint
export function createPiniaAdapter<State, Actions, Views>(
  componentFactory: ComponentFactory<State, Actions, Views>
) {
  return createLatticeStore(componentFactory, createStoreAdapter<State>());
}
```

### Step 5: Update Tests

Delete all existing tests and create new ones:

```typescript
describe('Lattice Core', () => {
  it('should create state', () => {
    const state = createState({ count: 0 });
    expect(state).toEqual({ count: 0 });
  });
  
  it('should create slices with access to state', () => {
    const state = createState({ count: 0 });
    const actions = createSlice(state, ({ get, set }) => ({
      increment: () => set({ count: get().count + 1 })
    }));
    
    // Test with mock tools
    const mockTools = {
      get: () => ({ count: 5 }),
      set: vi.fn()
    };
    
    const methods = actions(mockTools);
    methods.increment();
    
    expect(mockTools.set).toHaveBeenCalledWith({ count: 6 });
  });
  
  it('should support slice composition', () => {
    const state = createState({ count: 0 });
    
    const baseSlice = createSlice(state, ({ get, set }) => ({
      increment: () => set({ count: get().count + 1 })
    }));
    
    const enhancedSlice = createSlice(state, (tools) => ({
      ...baseSlice(tools),
      double: () => tools.set({ count: tools.get().count * 2 })
    }));
    
    const mockTools = { get: () => ({ count: 5 }), set: vi.fn() };
    const methods = enhancedSlice(mockTools);
    
    expect(methods).toHaveProperty('increment');
    expect(methods).toHaveProperty('double');
  });
});
```

### Step 6: Update Examples

Replace all examples with new pattern:

```typescript
// Todo app example
const todoApp = () => {
  const state = createState<{
    todos: Array<{ id: string; text: string; done: boolean }>;
    filter: 'all' | 'active' | 'completed';
  }>({
    todos: [],
    filter: 'all'
  });
  
  const actions = createSlice(state, ({ get, set }) => ({
    addTodo: (text: string) => {
      const newTodo = { id: Date.now().toString(), text, done: false };
      set({ todos: [...get().todos, newTodo] });
    },
    toggleTodo: (id: string) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, done: !todo.done } : todo
        )
      });
    },
    setFilter: (filter: 'all' | 'active' | 'completed') => {
      set({ filter });
    }
  }));
  
  const views = createSlice(state, ({ get }) => ({
    filteredTodos: () => {
      const { todos, filter } = get();
      if (filter === 'active') return todos.filter(t => !t.done);
      if (filter === 'completed') return todos.filter(t => t.done);
      return todos;
    },
    todoCount: () => get().todos.filter(t => !t.done).length
  }));
  
  return { state, actions, views };
};
```

## Benefits of New Architecture

1. **Serializable by default** - State is always pure data
2. **Simpler mental model** - State is data, slices are behavior
3. **Better type inference** - TypeScript can better understand the separation
4. **Natural composition** - Slices compose through function calls
5. **Framework alignment** - Matches how Redux Toolkit, Zustand, etc. think about state

## Notes for Implementation

- Start with core functions first
- Get basic tests passing before updating adapters
- Don't worry about gradual migration
- Focus on simplicity over feature parity
- State should be JSON-serializable by design