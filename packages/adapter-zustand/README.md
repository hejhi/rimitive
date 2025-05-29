# @lattice/adapter-zustand

A Zustand adapter for Lattice that provides seamless integration with Zustand's powerful state management. The adapter follows Zustand's auto-generating selectors pattern, providing a familiar API that feels natural to Zustand users while avoiding namespace collisions.

## Installation

```bash
npm install @lattice/adapter-zustand zustand
```

## Usage

```typescript
import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Define your component
const counter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment,
    decrement: m.decrement,
  }));

  const displaySlice = createSlice(model, (m) => ({
    value: m.count,
    text: `Count: ${m.count}`,
  }));

  return { 
    model, 
    actions,
    views: {
      display: displaySlice,
    },
  };
});

// Create a Zustand adapter - returns an enhanced store
const store = createZustandAdapter(counter);

// React usage - feels just like Zustand!
function Counter() {
  // Use auto-generated selectors via .use property
  const count = store.use.count();
  
  // Access actions through .actions property
  const increment = store.actions.increment();
  
  // Access view stores through .views property
  const display = store.views.display.use();
  
  return (
    <div>
      <p>{display.text}</p>
      <button onClick={increment}>{count}</button>
    </div>
  );
}

// Vanilla usage - it's a standard Zustand store
const state = store.getState();
state.increment();
console.log(store.getState().count); // 1
```

## API

### `createZustandAdapter(componentFactory)`

Creates an enhanced Zustand store following Zustand's auto-generating selectors pattern.

**Parameters:**
- `componentFactory`: A Lattice component factory function

**Returns:** An enhanced Zustand store that extends the standard StoreApi with:
- `.use`: Auto-generated selectors for each model property (just like Zustand's pattern!)
- `.actions`: Hook selectors for action methods
- `.views`: Reactive view stores with their own `.use` selectors

```typescript
const store = createZustandAdapter(component);

// Standard Zustand store methods
store.getState();
store.setState(newState);
store.subscribe(listener);

// Enhanced properties following Zustand patterns
store.use.count();              // Hook selector for count
store.actions.increment();      // Hook selector for increment action
store.views.display.use();      // Hook selector for display view
```

### The Pattern: Auto-Generated Selectors

Just like Zustand's own auto-generating selectors, the adapter creates hooks automatically:

```typescript
// Your model
const model = createModel(({ set, get }) => ({
  count: 0,
  user: { name: 'Alice', id: 1 },
  todos: [],
  increment: () => set({ count: get().count + 1 })
}));

// The adapter generates
store.use.count()    // Hook for count
store.use.user()     // Hook for user
store.use.todos()    // Hook for todos

// Actions get their own namespace
store.actions.increment()  // Hook for increment action
```

### Store Interface

```typescript
interface ZustandAdapterStore<Model, Actions, Views> extends StoreApi<Model> {
  // Auto-generated selectors - just like Zustand!
  use: {
    [K in keyof Model]: () => Model[K];
  };
  
  // Action hooks - clean namespace
  actions: {
    [K in keyof Actions]: () => Actions[K];
  };
  
  // View stores with their own selectors
  views: {
    [K in keyof Views]: ViewStore<Views[K]>;
  };
}

interface ViewStore<T> {
  get: () => T;
  use: () => T;
  subscribe: (listener: (state: T) => void) => () => void;
}
```

## Features

- **Familiar Zustand patterns**: Auto-generating selectors via `.use` property
- **Clean namespace separation**: Model properties never collide with adapter properties
- **Full Zustand compatibility**: Works with all middleware, DevTools, and Zustand features
- **Type-safe throughout**: Complete TypeScript support with inference
- **Reactive view stores**: Each view gets its own store with `.use` selector
- **Seamless composition**: Full support for Lattice's `select()` markers

## Working with Views

Views are reactive stores that provide UI attributes. Each view gets its own `.use` selector:

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment,
  }));

  // Static view - a slice that returns UI attributes
  const buttonSlice = createSlice(model, (m) => ({
    onClick: select(actions).increment,
    disabled: m.count >= 10,
    'aria-label': `Count: ${m.count}`,
  }));

  // Computed view - a function that returns UI attributes
  const displayView = () => 
    createSlice(model, (m) => ({
      count: m.count,
    }))((state) => ({
      text: `Current count: ${state.count}`,
      className: state.count > 5 ? 'high' : 'low',
    }));

  return {
    model,
    actions,
    views: {
      button: buttonSlice,      // Static view
      display: displayView,     // Computed view
    },
  };
});

const store = createZustandAdapter(component);

// React usage - views have their own .use selectors!
function MyComponent() {
  const button = store.views.button.use();
  const display = store.views.display.use();
  
  return (
    <div className={display.className}>
      <p>{display.text}</p>
      <button 
        onClick={button.onClick}
        disabled={button.disabled}
        aria-label={button['aria-label']}
      >
        Increment
      </button>
    </div>
  );
}

// Vanilla usage
const buttonAttrs = store.views.button.get();
console.log(buttonAttrs['aria-label']); // "Count: 0"

// Subscribe to view changes
store.views.button.subscribe((attrs) => {
  console.log('Button updated:', attrs);
});
```

## Using select() for Composition

The adapter seamlessly resolves `select()` markers, enabling powerful composition:

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    user: { id: 1, name: 'Alice' },
    posts: [{ id: 1, title: 'Hello' }],
    updateUser: (name: string) => 
      set({ user: { ...get().user, name } }),
  }));

  const userSlice = createSlice(model, (m) => m.user);
  const postsSlice = createSlice(model, (m) => m.posts);
  const actions = createSlice(model, (m) => ({
    updateUser: m.updateUser,
  }));

  // Compose slices using select() - clean and declarative!
  const profileSlice = createSlice(model, () => ({
    userName: select(userSlice).name,
    postCount: select(postsSlice).length,
    onUpdateName: select(actions).updateUser,
  }));

  return {
    model,
    actions,
    views: { profile: profileSlice },
  };
});

const store = createZustandAdapter(component);

// React usage
function Profile() {
  const profile = store.views.profile.use();
  const [newName, setNewName] = useState('');
  
  return (
    <div>
      <h2>{profile.userName}'s Profile</h2>
      <p>Posts: {profile.postCount}</p>
      <input 
        value={newName} 
        onChange={(e) => setNewName(e.target.value)}
      />
      <button onClick={() => profile.onUpdateName(newName)}>
        Update Name
      </button>
    </div>
  );
}

// Vanilla usage
const profile = store.views.profile.get();
console.log(profile.userName); // "Alice"
profile.onUpdateName('Bob');
console.log(store.use.user().name); // "Bob"
```

## Avoiding Namespace Collisions

The beauty of this pattern is complete namespace separation. Your model can use ANY property names:

```typescript
const component = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    // Model can freely use reserved names!
    use: 'my-use-data',
    actions: 'my-actions-data', 
    views: 'my-views-data',
    store: 'my-store-data',
    getState: 'my-getState-data',
    setState: 'my-setState-data',
    
    update: (field: string, value: string) => 
      set({ ...get(), [field]: value }),
  }));

  return {
    model,
    actions: createSlice(model, (m) => ({ update: m.update })),
    views: {},
  };
});

const store = createZustandAdapter(component);

// Adapter properties are always available
console.log(typeof store.use); // "object" - the selector namespace
console.log(typeof store.actions); // "object" - the actions namespace
console.log(typeof store.getState); // "function" - Zustand method

// Model properties are accessed through selectors
const use = store.use.use(); // Gets model.use value
const actions = store.use.actions(); // Gets model.actions value

console.log(use); // "my-use-data"
console.log(actions); // "my-actions-data"

// React usage - no conflicts!
function Component() {
  const modelUse = store.use.use();
  const modelActions = store.use.actions();
  const update = store.actions.update();
  
  return (
    <div>
      <p>Model use: {modelUse}</p>
      <p>Model actions: {modelActions}</p>
      <button onClick={() => update('use', 'updated!')}>
        Update
      </button>
    </div>
  );
}
```

## With Zustand Middleware

The adapter returns a standard Zustand store, so middleware works seamlessly:

```typescript
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// Option 1: Apply middleware after creation
const store = createZustandAdapter(component);
const storeWithSubs = subscribeWithSelector(store);

// Subscribe to specific fields
storeWithSubs.subscribe(
  (state) => state.count,
  (count) => console.log('Count changed:', count)
);

// Option 2: Create adapter with middleware (recommended)
const createEnhancedAdapter = (component) => {
  const baseStore = createZustandAdapter(component);
  return devtools(subscribeWithSelector(baseStore));
};

const store = createEnhancedAdapter(counter);

// Now you have DevTools + granular subscriptions!
store.subscribe(
  (state) => state.user,
  (user) => console.log('User changed:', user),
  { equalityFn: shallow }
);

// The enhanced properties still work
function App() {
  const count = store.use.count();
  const increment = store.actions.increment();
  
  return <button onClick={increment}>{count}</button>;
}
```

## Best Practices

1. **Follow Zustand patterns**: Use `.use` selectors in React components for optimal performance
2. **Consistent action access**: Always use `store.actions.method()` hooks in components
3. **View stores are reactive**: Each view has `.use()`, `.get()`, and `.subscribe()`
4. **Leverage TypeScript**: Full type inference throughout the adapter
5. **Compose fearlessly**: The adapter handles all `select()` resolutions automatically

## Comparison with Memory Adapter

The Zustand adapter provides:
- Production-ready state management
- React optimization out of the box
- DevTools integration potential
- Larger ecosystem and community
- Battle-tested performance

The memory adapter is better for:
- Testing and development
- Lightweight scenarios
- Learning Lattice patterns
- Non-React environments

## Migration Guide

If you're coming from Zustand, the patterns will feel familiar:

```typescript
// Standard Zustand
const useStore = create((set, get) => ({
  count: 0,
  increment: () => set({ count: get().count + 1 })
}));

// With auto-generating selectors
const store = createSelectors(useStore);
const count = store.use.count();

// Lattice with Zustand adapter - same pattern!
const store = createZustandAdapter(counter);
const count = store.use.count();
const increment = store.actions.increment();
```

If migrating from the memory adapter:

```typescript
// Memory adapter
const adapter = createMemoryAdapter();
const { model, actions, views } = adapter.executeComponent(component);
const state = model.get();
actions.get().increment();

// Zustand adapter - cleaner API
const store = createZustandAdapter(component);
const state = store.getState();
store.use.count(); // In React
store.actions.increment(); // Action hook

// The big win: React optimization built-in
function Component() {
  const count = store.use.count(); // Only re-renders on count change
  const increment = store.actions.increment();
  
  return <button onClick={increment}>{count}</button>;
}
```

## Why This Pattern?

The `.use`, `.actions`, and `.views` pattern provides several benefits:

1. **Familiar to Zustand users**: Follows Zustand's own auto-generating selectors pattern
2. **Zero namespace collisions**: Model can use any property names without conflicts
3. **Optimized for React**: Selectors ensure minimal re-renders automatically
4. **Clean organization**: Clear separation between state, actions, and views
5. **Type-safe**: TypeScript knows exactly what's available in each namespace

## Summary

The Zustand adapter brings the best of both worlds:
- **Lattice's power**: Compositional behavior specifications with `select()`
- **Zustand's performance**: Battle-tested React optimization and state management
- **Familiar patterns**: Auto-generating selectors that Zustand users already know

For React applications, this adapter provides the ideal combination of developer experience, performance, and maintainability.