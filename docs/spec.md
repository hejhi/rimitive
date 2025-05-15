# Lattice

A **headless component framework** built on Zustand. Lattice lattices are both the declarative contract and the actual API for your component—defining, composing, and enforcing the API surface at both the type and runtime level. Its core compositional mechanism is a fluent composition pattern with `.with()` method, enabling contract preservation, extensibility, and best-in-class developer experience. React‑first DX with a framework‑agnostic core.

## Core Concepts

### What is a Lattice?

A **lattice** is both the declarative contract and the actual API for your component:

- **API Surface**: When you define a lattice, you specify the API consumers will use
- **Contract Enforcement**: Composing any part changes the contract at both type and runtime levels
- **Predictable Variations**: Providing callbacks allows you to select, filter, or extend the API surface

### Mental Model & Flow

```
                   ┌───────── Contract/Reactive Models ─────────┐
                   ▼                  ▼                        ▼
View event ──▶ Actions ──▶ Model Mutation ──▶ State/View update ──▶ UI re‑render
```

| Component | Purpose                                                           | Accessibility                      |
|-----------|-------------------------------------------------------------------|------------------------------------|
| **Model** | Contains state and business logic (HOW)                           | Internal (composition only)        |
| **Actions** | Pure intent functions representing operations (WHAT)            | Internal (composition only)        |
| **State** | Public selectors providing read access to the model               | Public (composition & consumption) |
| **View**  | Reactive representations transforming state into UI attributes    | Public (composition & consumption) |

### Fluent Composition Pattern

Lattice uses a two-phase fluent composition pattern:

1. **Creation Phase**: Factory functions create base components
   ```typescript
   const counterModel = createModel(({ set, get }) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 })),
   }));
   ```

2. **Composition Phase**: The `.with()` method adds new properties or behaviors
   ```typescript
   const enhancedModel = compose(counterModel).with(({ get }) => ({
     incrementTwice: () => {
       get().increment();
       get().increment();
     },
   }));
   ```

## Building Blocks

### Model – Primary Unit of Composition

Models encapsulate state and business logic, defining the contract for state and mutations. They are available for composition but not exposed to consumers.

```typescript
// Create a model with state and methods
const counterModel = createModel(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// Compose to add new behavior
const enhancedModel = compose(counterModel).with(({ get }) => ({
  incrementTwice: () => {
    get().increment();
    get().increment();
  },
}));
```

### Actions – Pure Intent Functions

Actions represent WHAT should happen, delegating to model methods (HOW).

```typescript
// Create actions that delegate to model methods
const actions = createActions(({ mutate }) => ({
  increment: mutate(model).increment,
  incrementTwice: mutate(model).incrementTwice,
}));
```

### State – Public Selectors

State selectors provide read access to the model and form part of the public API surface.

```typescript
// Create state selectors
const state = createState(model).select(({ get }) => ({
  count: get().count,
  isPositive: get().count > 0,
}));

// Compose to add computed properties
const enhancedState = compose(state).with(({ get }) => ({
  doubled: get().count * 2,
  formatted: `Count: ${get().count}`,
}));
```

### View – Reactive UI Attributes

Views transform state into UI attributes and provide interaction logic.

```typescript
// Create a view with UI attributes and interaction handlers
const counterView = createView(state, actions).select(({ get }, actions) => ({
  "data-count": get().count,
  "aria-live": "polite",
  onClick: actions.increment,
}));

// Complex interaction logic is also supported
const advancedView = createView(state, actions).select(({ get }, actions) => ({
  onClick: (props) => {
    if (props.shiftKey) {
      actions.incrementTwice();
    } else {
      actions.increment();
    }
  },
}));
```

## Composition Example

```typescript
// Create a base lattice
const createCounterLattice = () => {
  // Define model with state and behavior
  const model = createModel(({ set, get }) => ({ count: 0 }));

  // compose a base model to augment it
  const enhancedModel = compose(model).with(({ set, get }) => ({
    // `count` is accessible in getters and setters, as is countMultiplied
    countMultiplied: get().count * 2,
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: state.count - 1 })),
  }));

  // Define actions that delegate to enhancedModel
  // MUST provide a Mutation; no other functions are allowed
  const actions = createActions(({ mutate }) => ({
    increment: mutate(enhancedModel).increment,
    decrement: mutate(enhancedModel).decrement,
  }));

  // Define state that exposes model properties
  const state = createState(enhancedModel).select(({ get }) => ({
    count: get().count,
    isPositive: get().count > 0,
  }));

  // Define views for UI
  const counterView = createView(state).select(({ get }) => ({
    "data-count": get().count,
    "aria-live": "polite",
  }));

  const buttonView = createView(null, actions).select((null, actions) => ({
    onClick: actions.increment(),
  }));

  // Return the lattice
  return createLattice({
    // if the user had provided a state/view/action that referenced a different model,
    // there would be a type error
    model: enhancedModel,
    actions, 
    state,
    view: {
      counter: counterView,
      button: buttonView,
    },
  });
};

// Create an enhanced lattice from the base lattice
const createEnhancedLattice = (baseLattice) => {
  // Enhance the model with new functionality
  const model = compose(baseLattice.getModel()).with(({ get }) => ({
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
    reset: () => get().set({ count: 0 }),
  }));

  // Add new actions for new model methods
  const actions = compose(baseLattice.getActions()).with(({ mutate }) => ({
    incrementTwice: mutate(model).incrementTwice,
    reset: mutate(model).reset,
  }));

  // Add new state properties
  const state = compose(baseLattice.getState()).with(({ get }) => ({
    doubled: get().count * 2,
    isEven: get().count % 2 === 0,
  }));

  // Enhance views (the namespace is a _required argument_ for getView())
  // the user can get all views to use as a spread with baseLattice.getViews(),
  // but that can't be passed to `compose`.
  const enhancedCounter = compose(baseLattice.getView('counter')).with(({ get }) => ({
    "data-doubled": get().doubled,
    "data-even": get().isEven,
  }));

  // Create new views
  const resetButton = createView(null, actions).select((null, actions) => ({
    onClick: actions.reset(),
  }));

  // Return the enhanced lattice
  return createLattice({
    model,
    actions,
    state,
    view: {
      ...baseLattice.getViews(),  // Keep original views
      counter: enhancedCounter,   // Override with enhanced view
      resetButton,                // Add new view
    },
  });
};
```

### Async Operations

Asynchronous operations follow the SAM pattern, with unidirectional flow:

```typescript
// Model contains all async logic and loading states
const model = createModel(({ set }) => ({
  users: [],
  loading: false,
  error: null,
  
  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/users");
      const users = await response.json();
      set({ users, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
}));

// Actions trigger async operations
const actions = createActions(({ mutate }) => ({
  fetchUsers: mutate(model).fetchUsers,
}));

// State exposes loading states reactively
const state = createState(model).select(({ get }) => ({
  users: get().users,
  isLoading: get().loading,
  error: get().error,
}));

// View reflects loading and error states
const view = createView(state).select(({ get }) => ({
  "aria-busy": get().isLoading,
  "data-has-error": get().error !== null,
}));
```

## Implementation Notes

### Slices-Based Architecture

Internally, Lattice uses a slices pattern to implement its compositional model while maintaining Zustand's performance benefits, creating a single zustand store:

```typescript
// Internal representation - all parts become slices of a single store
export const createLatticeStore = (config) => create((...a) => ({
  model: config.getModel(...a), // Model slice with prefixed properties
  state: config.getState(...a), // State slice with computed properties
  views: config.getViews(...a), // View slices for UI attributes
  actions: config.getActions(...a), // Actions slice for methods
}))
```

### Key Implementation Details

1. **Property Prefixing**: Each slice's properties are prefixed in the actual store (e.g., `model_count`, `state_isPositive`) to prevent collisions

2. **Selector Generation**: We'll adapt Zustand's auto-generated selectors pattern for both React and vanilla JS environments. Pseudocode example:
  ```typescript
  // selectorHelpers.ts
  import { UseStore } from 'zustand/vanilla';
  import { shallow } from 'zustand/shallow';

  type StoreShape = {
    model: unknown;
    state: Record<string, unknown>;
    views: Record<string, object>;
    actions: Record<string, (...args: any[]) => void>;
  };

  export function createSelectors<T extends StoreShape>(store: UseStore<T>) {
    return {
      // State selectors (primitive values)
      state: (key: keyof T['state']) => 
        useStore(store, (s) => s.state[key]),
        
      // View namespace selectors (objects with shallow compare)
      view: <K extends keyof T['views']>(namespace: K) =>
        useStore(store, (s) => s.views[namespace], shallow),
        
      // Action selector (stable function references)
      action: <K extends keyof T['actions']>(name: K) =>
        useStore(store, (s) => s.actions[name])
    };
  }

  // store.ts
  import { createStore } from 'zustand/vanilla';

  type Model = { count: number; theme: 'light' | 'dark' };
  type State = { count: number; isEven: boolean };
  type Views = { label: object; button: object };
  type Actions = { increment: () => void; toggleTheme: () => void };

  const store = createStore<Model & State & Views & Actions>((set, get) => ({
    // Model (private)
    model: { count: 0, theme: 'light' },
    
    // State (computed)
    get state() {
      return {
        count: get().model.count,
        isEven: get().model.count % 2 === 0
      };
    },
    
    // Views (namespaced, computed)
    get views() {
      return {
        label: {
          'aria-label': `Count: ${get().state.count}`,
          'data-theme': get().model.theme
        },
        button: {
          onClick: () => get().actions.increment(),
          style: { 
            color: get().model.theme === 'dark' ? 'white' : 'black' 
          }
        }
      };
    },
    
    // Actions (model mutators)
    actions: {
      increment: () => set(state => ({
        model: { ...state.model, count: state.model.count + 1 }
      })),
      toggleTheme: () => set(state => ({
        model: { 
          ...state.model, 
          theme: state.model.theme === 'light' ? 'dark' : 'light' 
        }
      }))
    }
  }));

  export const { state, view, action } = createSelectors(store);

  // example in React adaptor
  function Counter() {
    const count = state('count');
    const isEven = state('isEven');
    const labelProps = view('label');
    const buttonProps = view('button');
    const increment = action('increment');
    const toggleTheme = action('toggleTheme');

    return (
      <div {...labelProps}>
        <button {...buttonProps} onClick={increment}>
          Count: {count} ({isEven ? 'even' : 'odd'})
        </button>
        <button onClick={toggleTheme}>Toggle Theme</button>
      </div>
    );
  }
  ```
  - state() selectors use strict equality (primitives)
  - view() selectors use shallow comparison (objects)
  - action() selectors return stable function references

3. **Subscription Support**: The architecture enables targeted subscriptions to specific slices:
   ```typescript
   // Subscribe only to relevant state changes
   lattice.state.subscribe(
     state => console.log('State changed:', state),
     state => [state.count] // Dependencies array
   )
   ```

This implementation approach allows us to maintain the clean, compositional API surface while leveraging Zustand's performance optimizations under the hood.

## License

MIT