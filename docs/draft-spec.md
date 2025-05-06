# Lattice

A **headless component framework** built on Zustand. React‑first DX with
framework‑agnostic core.

---

## 1. Introduction

Lattice is a headless component framework that provides a structured approach to
building complex, composable UI components with clean separation of concerns. It
implements the SAM (State-Action-Model) pattern using Zustand stores as its
foundation.

### Core Value Propositions

- **SAM Architecture**: Actions → Model → State → View, with clean separation of
  concerns
- **Unified Model**: Getters and mutations in a single Model object with
  auto-generated hooks
- **Factory Composition**: Factories create reusable patterns that are only
  instantiated when needed
- **Contract Preservation**: Compositions extend but never break existing
  contracts
- **Lattice Composition**: Behaviors cooperate via public APIs—no model exposure
  or internal coupling
- **Zustand Foundation**: Familiar DX, dev‑tools time‑travel, no custom state
  engine
- **Instance-based Architecture**: Multiple independent instances with proper
  state isolation

### When to Use Lattice vs. Plain Hooks

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through model composition; views merge safely. |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; models are framework-agnostic; adapters are thin wrappers.                  |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Views are reactive composites, merged per UI part                                             |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Features can be added/removed at instantiation, with granular reactivity throughout models.   |

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> composability, portability, and proper state isolation**, Lattice provides the
> missing middle layer.

---

## 2. Core Concepts

### Glossary

| Terminology | Meaning                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| **Model**   | Primary unit of composition containing state and business logic with methods to implement domain operations.      |
| **Actions** | Pure intent functions that represent user operations without implementation details.                              |
| **State**   | Public selectors that provide read access to the model.                                                           |
| **View**    | Reactive state representations of components that transform state and actions into ready-to-spread UI attributes. |

Together, these make up a composable `lattice`.

### Mental Model & Flow

```
                   ┌───────── Reactive Models ─────────┐
                   ▼                  ▼                ▼
View event ──▶ Actions ──▶ Model Mutation ──▶ State/View update ──▶ UI re‑render
```

- One‑way data‑flow following SAM (State-Action-Model) pattern
- Actions represent pure intent (WHAT), triggering state changes through the
  Model
- Model contains business logic and state (HOW) and is the primary unit of
  composition
- Reactive flow: User events → Actions → Model → State → View → UI elements
- Lattice exposes only actions, views, and state (via selectors) for composition

### Public vs Internal APIs

```
       Consumable Public API

    ┌───────────┐    ┌───────────┐
    │           │    │           │
┌──▶│   State   │───▶│   View    │
│   │           │    │           │
│   └───────────┘    └───────────┘
│         │                │
--------------------------------------
│         │    Internal    │
│         ▼                │
│   ┌───────────┐          │
│   │           │          │
│   │  Actions  │◀─────────┘
│   │           │
│   └───────────┘
│         │
│         ▼
│   ┌───────────┐
│   │           │
└───│   Model   │
    │           │
    └───────────┘
```

- Only the derived State and View(s) are available via the Public API
- Composing lattices together allows _composition_ of every part
- Models are the source-of-truth, combining state and behavior

### Factory-Based Composition

Lattice uses a factory-based composition model:

1. Factory functions create reusable patterns, not actual instances
2. These patterns define behavior but don't allocate storage until needed
3. Actual stores are only created when a lattice is instantiated
4. This allows for:
   - Efficient composition without premature store creation
   - Type-safe contract enforcement across compositions
   - Clean separation between composition logic and implementation details
   - Lazy loading of enhanced lattice compositions:

```ts
// Core lattice with minimal functionality
const createCoreLattice = () => {
  const model = createModel()(({ set, get }) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
  }));

  const actions = createActions()(({ mutate }) => ({
    increment: mutate(model, "increment"),
  }));

  const state = createState()(({ derive }) => ({
    count: derive(model, "count"),
  }));

  return createLattice("core", { model, actions, state });
};

// Usage: Create core lattice immediately
const coreLattice = createCoreLattice();

// Then later, dynamically import an enhancement
// In enhancementModule.js:
export const enhanceWithFeature = (baseLattice) => {
  const model = createModel(baseLattice, ({ model, select }) => ({
    increment: select(model, "increment"),
  }))(({ set, get }) => ({
    // Add new functionality
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
  }));

  const actions = createActions(baseLattice, ({ actions, select }) => ({
    increment: select(actions, "increment"),
  }))(({ mutate }) => ({
    incrementTwice: mutate(model, "incrementTwice"),
  }));

  return createLattice(
    "enhanced",
    withLattice(baseLattice)({
      model,
      actions,
    }),
  );
};

// Dynamically load the enhancement when needed:
import("./enhancementModule.js").then((module) => {
  const enhancedLattice = module.enhanceWithFeature(coreLattice);
  // Start using enhanced lattice
});
```

---

## 3. Building Blocks

### Model - Primary Unit of Composition

Models are the fundamental building blocks in Lattice, encapsulating both state
and behavior. They provide a clean API for state access and mutations without
exposing implementation details.

```ts
// Create a standalone model factory with state and methods
const counterModel = createModel()(({ set, get }) => ({
  // Internal state
  count: 0,

  // State mutations
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),

  // State selectors
  getCount: () => get().count,
}));

// Model is a factory until used in a lattice
```

### Model Composition

Models can be composed together using the double-function IIFE pattern,
separating composition from implementation.

```ts
// Create independent model factories
const counterModel = createModel()(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  getCount: () => get().count,
}));

const labelModel = createModel()(({ set, get }) => ({
  label: "Counter",
  setLabel: (label) => set({ label }),
  getLabel: () => get().label,
}));

// Create standalone model (no composition)
const standaloneModel = createModel()(({ set, get }) => ({
  // Implementation without composition
}));
```

### Actions - Pure Intent Functions

Actions are pure intent functions that represent WHAT should happen, not HOW it
should happen. They are the primary entry points for state mutations and are
exposed in the public API. The double-function pattern separates composition
from implementation.

```ts
// Define Actions using createActions with double-function pattern - standalone
const actions = createActions()(({ mutate }) => ({
  // Actions directly reference model methods
  increment: mutate(model, "increment"),
  doubleIncrement: mutate(model, "incrementTwice"),
}));

// Composing with a lattice
const enhancedActions = createActions(baseLattice, ({ actions, select }) => ({
  // Select from the actions part of the lattice
  increment: select(actions, "increment"),
}))(({ mutate }) => ({
  // Add new actions
  incrementTwice: mutate(model, "incrementTwice"),
}));

// Composing with another actions factory
const combinedActions = createActions(baseActions, ({ actions, select }) => ({
  // Select from another actions factory
  increment: select(actions, "increment"),
}))(({ mutate }) => ({
  // Add new actions
  incrementThenReset: mutate(model, "incrementThenReset"),
}));

// Using an action directly (once the lattice is instantiated)
// actions.increment();
```

### State - Public Selectors

Public state selectors provide read access to the model state. They follow the
double-function pattern and can derive from model properties.

```ts
// Define public state selectors with double-function pattern - standalone
const state = createState()(({ get, derive }) => ({
  // State can derive from model properties
  count: derive(model, "count"),
  countPlusOne: derive(model, "count", (count) => count + 1),
  isPositive: () => get().count > 0,
}));

// Composing with a lattice
const enhancedState = createState(baseLattice, ({ state, select }) => ({
  // Select from the state part of the lattice
  count: select(state, "count"),
}))(({ get, derive }) => ({
  // Add new derived state
  doubled: derive(state, "count", (count) => count * 2),
}));

// Composing with another state factory
const combinedState = createState(baseState, ({ state, select }) => ({
  // Select from another state factory
  count: select(state, "count"),
}))(({ get, derive }) => ({
  // Add new derived state
  isNegative: () => get().count < 0,
}));

// Using a state selector (once the lattice is instantiated)
// const count = state.count;
// const isPositive = state.isPositive();
```

### View - Reactive UI Attributes

Views are reactive components that transform state and actions into
ready-to-spread UI attributes. They follow the double-function pattern and serve
as pure mappings from state and actions to UI properties. Views are parallel to
actions - they are pure selectors without functions or side effects.

```ts
// Create views with double-function pattern - standalone
const counterView = createView()(({ derive }) => ({
  // Views are pure mappings from state/actions to UI attributes
  "data-count": derive(state, "count"),
  "aria-live": "polite",
}));

// Composing with a lattice
const enhancedView = createView(baseLattice, ({ view, select }) => ({
  // Select from the view part of the lattice
  "data-count": select(view.counter, "data-count"),
}))(({ derive, dispatch }) => ({
  // Add new properties as pure mappings
  "aria-label": "Enhanced counter",
}));

// Composing with another view factory
const combinedView = createView(baseView, ({ view, select }) => ({
  // Select from another view factory
  "aria-live": select(view, "aria-live"),
}))(({ derive, dispatch }) => ({
  // Add new properties as pure value
  "data-enhanced": true,
}));

// For parameterized views, the parameters are passed to derive
const itemView = createView()(({ derive, dispatch }) => ({
  // derive handles param passing when the view is used
  "aria-selected": derive(state, "isSelected"),
  "data-highlighted": derive(state, "isHighlighted"),
  onClick: dispatch(actions, "selectItem"),
}));

// Usage (once lattice is instantiated):
// const itemProps = lattice.view.item.get({ id: "item-1" });
```

---

## 4. Progressive Examples

### Simple Component Example

A basic counter component implementation using Lattice with the new
double-function pattern:

```ts
// Create a counter lattice
const createCounter = () => {
  // Create counter model factory with state and behavior
  const model = createModel()(({ set, get }) => ({
    // State
    count: 0,

    // Behaviors
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: state.count - 1 })),
    incrementTwice: () => {
      get().increment();
      get().increment();
    },

    // Selectors
    getCount: () => get().count,
  }));

  // Define Actions factory - standalone
  const actions = createActions()(({ mutate }) => ({
    // Actions directly reference model methods
    increment: mutate(model, "increment"),
    decrement: mutate(model, "decrement"),
    incrementTwice: mutate(model, "incrementTwice"),
  }));

  // Define public state factory - standalone
  const state = createState()(({ get, derive }) => ({
    // Derive state from model
    count: derive(model, "getCount"),
    // Derived state properties
    countSquared: derive(model, "count", (count) => count * count),
  }));

  // Create views factory - standalone
  const counterView = createView()(({ derive }) => ({
    // Generate UI attributes as pure mappings
    "data-count": derive(state, "count"),
    "aria-live": "polite",
  }));

  const incrementButtonView = createView()(({ derive, dispatch }) => ({
    // Map UI event to action using dispatch
    onClick: dispatch(actions, "increment"),
  }));

  const decrementButtonView = createView()(({ derive, dispatch }) => ({
    // Map UI event to action using dispatch
    onClick: dispatch(actions, "decrement"),
  }));

  // Return composed lattice - the actual stores are created here
  return createLattice(
    "counter",
    {
      // Public API exposed for composition
      actions,
      view: mergeViews(counterView, incrementButtonView, decrementButtonView),
      state,
      model,
    },
  );
};
```

### Medium Complexity Example

A todo list with filtering capabilities using the double-function pattern:

```ts
// Create a todo list lattice
const createTodoList = () => {
  // Create the model factory
  const model = createModel()(({ set, get }) => ({
    // State
    todos: [],
    filter: "all",
    label: "Todo List",

    // Behaviors
    addTodo: (text) =>
      set((state) => ({
        todos: [...state.todos, { id: Date.now(), text, completed: false }],
      })),

    toggleTodo: (id) =>
      set((state) => ({
        todos: state.todos.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        ),
      })),

    setFilter: (filter) => set({ filter }),

    // Composite behaviors
    addAndFilterActive: (text) => {
      get().addTodo(text);
      get().setFilter("active");
    },

    // Internal selectors
    _getTodos: () => get().todos,
    _getFilter: () => get().filter,

    // Computed properties
    getFilteredTodos: () => {
      const todos = get().todos;
      const filter = get().filter;

      if (filter === "all") return todos;
      if (filter === "completed") {
        return todos.filter((todo) => todo.completed);
      }
      if (filter === "active") return todos.filter((todo) => !todo.completed);
      return todos;
    },

    getFilteredTodosCount: () => get().getFilteredTodos().length,

    isTodoCompleted: (id) => {
      const todo = get().todos.find((t) => t.id === id);
      return todo ? todo.completed : false;
    },
  }));

  // Define Actions factory - standalone
  const actions = createActions()(({ mutate }) => ({
    // Actions directly reference model methods
    addTodo: mutate(model, "addTodo"),
    toggleTodo: mutate(model, "toggleTodo"),
    setFilter: mutate(model, "setFilter"),
    addAndFilterActive: mutate(model, "addAndFilterActive"),
  }));

  // Define public state factory - standalone
  const state = createState()(({ get, derive }) => ({
    // Derived properties
    todos: derive(model, "_getTodos"),
    filter: derive(model, "_getFilter"),
    filteredTodos: derive(model, "getFilteredTodos"),
    filteredTodosCount: derive(model, "getFilteredTodosCount"),
    listLabel: "Todo List",
    isTodoCompleted: derive(model, "isTodoCompleted"),
  }));

  // Create views factory - standalone
  const todoListView = createView()(({ derive }) => ({
    // Generate UI attributes as pure mappings
    "aria-label": derive(state, "listLabel"),
    "data-count": derive(state, "filteredTodosCount"),
  }));

  const todoItemView = createView()(({ derive, dispatch }) => ({
    // Generate UI attributes as pure mappings
    "aria-checked": derive(state, "isTodoCompleted"),
    // Connect to action with dispatch
    onClick: dispatch(actions, "toggleTodo"),
  }));

  // Return composed lattice
  return createLattice(
    "todoList",
    {
      // Public API exposed for composition
      actions,
      view: mergeViews(todoListView, todoItemView),
      state,
      model,
    },
  );
};
```

### Complex Component Example - Composition

Creating a complex component through factory composition:

```ts
// Create independent model factories for specific concerns
const selectionModelFactory = createModel()(({ set, get }) => ({
  // State
  selected: [],

  // Behaviors
  selectItem: (id, isMulti = false) =>
    set((state) => ({
      selected: isMulti ? [...state.selected, id] : [id],
    })),

  deselectItem: (id) =>
    set((state) => ({
      selected: state.selected.filter((itemId) => itemId !== id),
    })),

  clearSelection: () => set({ selected: [] }),

  // Selectors
  isSelected: (id) => get().selected.includes(id),
  getSelected: () => get().selected,
}));

const itemsModelFactory = createModel()(({ set, get }) => ({
  // State
  items: [],

  // Behaviors
  setItems: (items) => set({ items }),
  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),

  // Selectors
  getItems: () => get().items,
  getItem: (id) => get().items.find((item) => item.id === id),
}));

// Factory function that returns a lattice composer
export const createFeature = () => {
  // Returns a function that takes a base lattice and returns an enhanced lattice
  return (baseLattice) => {
    // Create composite model factory by combining other factories
    const model = createModel()(({ set, get, derive }) => ({
      // State
      highlighted: null,

      // Derive from the composed factories
      selected: derive(selectionModelFactory, "selected"),
      items: derive(itemsModelFactory, "items"),

      // Behaviors that use the derived state
      selectItem: (id, isMulti = false) => {
        selectionModelFactory.selectItem(id, isMulti);
      },

      isSelected: derive(selectionModelFactory, "isSelected"),
      getItems: derive(itemsModelFactory, "getItems"),

      // Composite behaviors
      getItemsWithSelection: () => {
        return get().items.map((item) => ({
          ...item,
          selected: get().isSelected(item.id),
        }));
      },

      selectAndHighlight: (id) => {
        // Call methods
        get().selectItem(id);
        // Update internal state
        set({ highlighted: id });
      },

      isHighlighted: (id) => get().highlighted === id,
    }));

    // Define Actions factory - using compose with baseLattice
    const actions = createActions(baseLattice, ({ actions, select }) => ({
      // Select from base lattice actions if needed
    }))(({ mutate }) => ({
      // Define new actions
      selectItem: mutate(model, "selectItem"),
      selectAndHighlight: mutate(model, "selectAndHighlight"),
    }));

    // Define public state factory - using compose with baseLattice
    const state = createState(baseLattice, ({ state, select }) => ({
      // Select from base lattice state if needed
    }))(({ get, derive }) => ({
      // Add new derived state
      itemsWithSelection: derive(model, "getItemsWithSelection"),
      isSelected: derive(model, "isSelected"),
      isHighlighted: derive(model, "isHighlighted"),
    }));

    // Create views factory - using compose with baseLattice
    const itemView = createView(baseLattice, ({ view, select }) => ({
      // Select from base lattice view if needed
      role: select(view.item, "role"),
    }))(({ derive, dispatch }) => ({
      // Generate UI attributes as pure mappings
      "aria-selected": derive(state, "isSelected"),
      "data-highlighted": derive(state, "isHighlighted"),
      onClick: dispatch(actions, "selectAndHighlight"),
    }));

    // Return enhanced lattice, actual stores are created here
    return createLattice(
      "featureName",
      withLattice(baseLattice)({
        // Public API exposed for composition
        actions,
        view: mergeViews(itemView),
        state,
        model,
      }),
    );
  };
};
```

## 5. Composition Patterns

### Standalone Creation Pattern

Creating standalone factories:

```ts
// Standalone model factory (no composition)
const model = createModel()(({ set, get }) => ({
  // Implementation without composition
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  getCount: () => get().count,
}));

// Standalone state factory (no composition)
const state = createState()(({ get }) => ({
  // Implementation without composition
  value: 10,
  getValue: () => get().value,
}));

// Standalone view factory (no composition)
const view = createView()(({ get }) => ({
  // Implementation without composition
  className: "my-component",
  ariaLabel: "Example component",
}));
```

### Full Lattice Composition Pattern

Composing entire lattices together:

```ts
// Create base lattice
const createBaseLattice = () => {
  // Implementation details...
  return createLattice("base", { model, state, view, actions });
};

// Create enhancement feature using full lattice composition
const createEnhancedLattice = (baseLattice) => {
  // Compose state fully (without modifying contract)
  const state = createState(baseLattice)((get, derive) => ({
    // Can add new properties but can't override existing ones
    newProperty: "value",
    derivedProperty: derive(
      baseLattice.state,
      "someProperty",
      (prop) => `Modified: ${prop}`,
    ),
  }));

  // Compose model fully
  const model = createModel(baseLattice)((set, get) => ({
    // Can add new properties but can't override existing ones
    newMethod: () => console.log("New method called"),
  }));

  // Return enhanced lattice
  return createLattice(
    "enhanced",
    withLattice(baseLattice)({
      state,
      _internal: { model },
    }),
  );
};
```

### Selective Composition Pattern

Cherry-picking specific properties for composition:

```ts
// Create specific state properties
const state = createState(baseLattice, ({ state, select }) => ({
  // Only select specific properties
  count: select(state, "count"),
  isActive: select(state, "isActive"),
  // Map existing property to new name
  renamedProperty: select(state, "originalName"),
}))((get, derive) => ({
  // Now implement with selected properties
  doubleCount: derive(state, "count", (count) => count * 2),
}));

// Compose with filtering
const model = createModel(baseModel, (model, select) =>
  filterMap(
    model,
    (key) => key !== "privateMethod" && { [key]: select(model, key) },
  ))((set, get) => ({
    // Implementation with filtered properties
  }));
```

### Contract Preservation Pattern

Ensuring contract preservation across compositions:

```ts
// Base model defines a contract
const baseModel = createModel()((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  getCount: () => get().count,
}));

// Enhanced model must preserve the contract
const enhancedModel = createModel(baseModel)((set, get) => ({
  // These methods MUST be present with compatible signatures
  // to preserve the base contract
  count: get().count, // Preserved
  increment: get().increment, // Preserved
  getCount: get().getCount, // Preserved

  // New methods can be added safely
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// This would cause a type error - breaking the contract
const invalidModel = createModel(baseModel)((set, get) => ({
  // Type error: missing required property 'increment'
  count: get().count,
  getCount: get().getCount,
  // Type error: incompatible signature
  // increment: (amount) => set(state => ({ count: state.count + amount })),
}));
```

## 6. The Derive System

The `derive` function allows for creating reactive subscriptions between models,
states, and views:

```ts
// Model as source of truth (no derive)
const model = createModel()(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// State derives from model in the SECOND function
const state = createState()(({ get, derive }) => ({
  // Derive count from model
  count: derive(model, "count"),

  // Derive with transformation
  doubled: derive(model, "count", (count) => count * 2),

  // Derive from multiple properties
  status: derive(model, "count", (count) => count > 0 ? "positive" : "zero"),
}));

// Views derive from state in the SECOND function
const view = createView()(({ derive, dispatch }) => ({
  // Derive attribute from state
  "data-count": derive(state, "count"),

  // Derive with transformation
  className: derive(
    state,
    "status",
    (status) => `counter counter--${status}`,
  ),

  // Connect to action with dispatch
  onClick: dispatch(actions, "increment"),
}));

// COMPOSITION is different from deriving and happens in the FIRST function
const composedState = createState(baseLattice, ({ state, select }) => ({
  // This is COMPOSITION: selecting from a lattice's state
  count: select(state, "count"),
  status: select(state, "status"),
}))(({ get, derive }) => ({
  // This is DERIVING: creating reactive subscriptions
  formattedCount: derive(model, "count", (count) => `Count: ${count}`),
}));

// Another example of proper composition
const composedView = createView(otherView, ({ view, select }) => ({
  // This is COMPOSITION: selecting from another view
  className: select(view, "className"),
  "aria-live": select(view, "aria-live"),
}))(({ derive, dispatch }) => ({
  // This is DERIVING: creating reactive subscriptions
  "data-value": derive(state, "count"),
  // Connect to action with dispatch
  onClick: dispatch(actions, "increment"),
}));
```

### Composition vs. Deriving

It's important to understand the difference between composition and deriving:

1. **Composition** happens in the first function of the IIFE pattern:

```ts
createState(sourceToCompose, ({ state, select }) => ({
  // Select properties from the source to compose with
  property: select(state, "property"),
}));
```

2. **Deriving** happens in the second function of the IIFE pattern:
   ```ts
   createState(...)(({ get, derive, dispatch }) => ({
     // Create reactive subscriptions
     property: derive(model, "property")
   }))
   ```

Let's look at a correct full example:

```ts
// Creating state that composes from a lattice
const enhancedState = createState(baseLattice, ({ state, select }) => ({
  // COMPOSITION: Select from the state part of the lattice
  count: select(state, "count"),
  status: select(state, "status"),
}))(({ get, derive }) => ({
  // DERIVING: Create reactive subscriptions
  doubled: derive(model, "count", (count) => count * 2),
  formattedStatus: derive(state, "status", (status) => `Status: ${status}`),
}));

// Creating model that composes from a lattice
const enhancedModel = createModel(baseLattice, ({ model, select }) => ({
  // COMPOSITION: Select from the model part of the lattice
  increment: select(model, "increment"),
  getCount: select(model, "getCount"),
}))(({ set, get, derive }) => ({
  // Implementation with composed properties
  // Add new properties or behaviors
  incrementTwice: () => {
    get().increment();
    get().increment();
  },
}));

// Creating view that composes from a lattice
const enhancedView = createView(baseLattice, ({ view, select }) => ({
  // COMPOSITION: Select from the view part of the lattice
  "aria-live": select(view.counter, "aria-live"),
}))(({ derive, dispatch }) => ({
  // DERIVING: Create reactive subscriptions
  "data-count": derive(state, "count"),
  "aria-label": "Enhanced counter",
  // Connect to action with dispatch
  onClick: dispatch(actions, "increment"),
}));
```

## 7. Advanced Topics

### Action System

Actions are pure intent functions that delegate directly to model methods
without containing their own implementation logic:

```ts
// Model defines all behavior including composite operations
const model = createModel()(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),

  // Composite behaviors belong in the model
  incrementTwice: () => {
    get().increment();
    get().increment();
  },

  resetAndIncrement: () => {
    get().reset();
    get().increment();
  },
}));

// Actions are pure delegates to model methods
const actions = createActions()(({ mutate }) => ({
  // Each action directly references a model method
  increment: mutate(model, "increment"),
  reset: mutate(model, "reset"),
  incrementTwice: mutate(model, "incrementTwice"),
  resetAndIncrement: mutate(model, "resetAndIncrement"),
}));

// Composing actions from other actions
const enhancedActions = createActions(baseActions, ({ actions, select }) => ({
  // Select from base actions
  increment: select(actions, "increment"),
  reset: select(actions, "reset"),
}))(({ mutate }) => ({
  // Add new actions that reference model methods
  incrementThrice: mutate(model, "incrementThrice"),
}));
```

The key principle is that actions should only contain references to model
methods, not function implementations. This ensures a clean separation of
concerns:

- **Model**: Contains all business logic and state (HOW)
- **Actions**: Pure intent functions representing WHAT should happen
- **State**: Read-only selectors derived from model
- **Views**: Pure mappings to UI properties

This architecture maintains a clean one-way flow and proper separation of
concerns.

### Asynchronous Operations Pattern

Asynchronous operations follow the same SAM pattern, with state changes flowing
unidirectionally through the system:

```ts
// Model contains all async logic and loading/error states
const model = createModel()(({ set, get }) => ({
  // State for async operations
  users: [],
  loading: false,
  error: null,

  // Async operation
  fetchUsers: async () => {
    // Set loading state
    set({ loading: true, error: null });

    try {
      // Perform async operation
      const response = await fetch("https://api.example.com/users");
      const users = await response.json();

      // Update state with results
      set({ users, loading: false });
    } catch (error) {
      // Handle errors
      set({ error: error.message, loading: false });
    }
  },

  // Selective fetch with parameters
  fetchUserById: async (id) => {
    set((state) => ({
      loading: true,
      error: null,
      // Mark specific user as loading
      users: state.users.map((user) =>
        user.id === id ? { ...user, isLoading: true } : user
      ),
    }));

    try {
      const response = await fetch(`https://api.example.com/users/${id}`);
      const userData = await response.json();

      set((state) => ({
        loading: false,
        // Update specific user
        users: state.users.map((user) =>
          user.id === id ? { ...userData, isLoading: false } : user
        ),
      }));
    } catch (error) {
      set((state) => ({
        error: error.message,
        loading: false,
        // Clear loading state on error
        users: state.users.map((user) =>
          user.id === id
            ? { ...user, isLoading: false, error: error.message }
            : user
        ),
      }));
    }
  },
}));

// Actions trigger async operations but don't return promises
const actions = createActions()(({ mutate }) => ({
  // Actions reference model methods
  fetchUsers: mutate(model, "fetchUsers"),
  fetchUserById: mutate(model, "fetchUserById"),
}));

// State exposes loading/error states reactively
const state = createState()(({ derive }) => ({
  users: derive(model, "users"),
  isLoading: derive(model, "loading"),
  error: derive(model, "error"),

  // Derived states
  hasUsers: derive(model, "users", (users) => users.length > 0),
  hasError: derive(model, "error", (error) => error !== null),
}));

// Views reflect loading and error states
const userListView = createView()(({ derive }) => ({
  "aria-busy": derive(state, "isLoading"),
  "aria-live": "polite",
  "data-has-error": derive(state, "hasError"),
  "data-error-message": derive(state, "error"),
}));

// Usage:
// 1. Trigger async action
// actions.fetchUsers();
//
// 2. React to state changes
// const isLoading = state.isLoading;
// const error = state.error;
// const users = state.users;
//
// 3. Use view props
// const userListProps = view.userList.get();
// <div {...userListProps}>
//   {isLoading && <Spinner />}
//   {error && <ErrorMessage message={error} />}
//   {!isLoading && !error && users.map(user => <UserItem key={user.id} user={user} />)}
// </div>
```

This pattern maintains the SAM architecture's unidirectional data flow while
handling async operations:

1. Actions trigger intent without returning values
2. Models contain all async logic and state management
3. State reactively exposes loading/error conditions
4. Views transform these states into UI attributes
5. Components react to state changes

### Direct Action Dispatch

Lattice provides direct access to Actions for state mutation:

```ts
// ✅ Direct Action dispatch (preferred)
selectionActions.selectNode(id, multi);
dragActions.startDrag(id);

// ✅ State selectors provide read access
const isSelected = selectionState.isSelected(id);
```

This pattern:

- Enforces separation of concerns
- Creates cleaner, more traceable code
- Follows the SAM pattern
- Improves testability and debugging
