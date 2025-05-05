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
- **Hooks System**: Clean interception points for cross-cutting concerns
- **Layered Zustand Stores**: States → Model → View, with precise reactivity
- **Lattice Composition**: Behaviors cooperate via hooks—no fragile ref hacks
- **Zustand Foundation**: Familiar DX, dev‑tools time‑travel, no custom state
  engine
- **Instance-based Architecture**: Multiple independent instances with proper
  state isolation

### When to Use Lattice vs. Plain Hooks

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through layered Zustand stores; views merge safely. |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework-agnostic; adapters are thin wrappers.                       |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Views are reactive Zustand stores, merged per UI part                                              |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Features can be added/removed at instantiation, with granular reactivity throughout stores.        |

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> composability, portability, and proper state isolation**, Lattice provides the
> missing middle layer.

---

## 2. Core Concepts

### Glossary

| Term        | Meaning                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| **State**   | Private Zustand store created with `create`.                                  |
| **Actions** | Pure intent functions that trigger state changes through the Model.           |
| **Model**   | Unified public interface with getters (selectors) and setters (mutations).    |
| **View**    | Reactive Zustand store that returns ready-to-spread UI attributes.            |
| **Hooks**   | System to intercept mutations for cross-cutting concerns (`before`/`after`).  |
| **Lattice** | Bundle of Models, views with namespaces. Lattices can compose other lattices. |

### Mental Model & Flow

```
                   ┌──────────── Reactive Zustand Stores ───────────┐
                   ▼                  ▼                    ▼
View event ──▶ Actions ──▶ Hooks ──▶ Model ──▶ State mutation ──▶ UI re‑render
```

- One‑way data‑flow following SAM (State-Action-Model) pattern
- Actions represent pure intent, triggering state changes through the Model
- Model contains business logic and mediates between Actions and State
- Reactive composition: User events → Actions → Model → State → View → UI
  elements
- Each layer is a Zustand store, enabling precise subscriptions and memoization
- Hooks provide interception points for cross-cutting concerns

---

## 3. Building Blocks

### State - Private Zustand Stores

Private state stores form the foundation of the Lattice architecture. They are
created using Zustand's `create` function and encapsulate the raw state data.

```ts
// Create private state store
const countState = create(() => ({ count: 0 }));

// State can be updated directly or through the Model
countState.setState((state) => ({ count: state.count + 1 }));
```

### Model - Business Logic Layer

The Model provides a unified public interface with getters (selectors) and
setters (mutations). It subscribes to one or more state stores and exposes
methods to interact with the state.

```ts
// Create Model with subscription to private store
const { model } = createModel(
  withStoreSubscribe(countState, (state) => ({
    count: state.count,
  })),
)((set, get, selectedState) => ({
  getCount: () => selectedState.count,
  increment: () => countState.setState((state) => ({ count: state.count + 1 })),
}));
```

### Actions - Pure Intent Functions

Actions are pure intent functions that trigger state changes through the Model.
They represent what should happen, not how it should happen.

```ts
// Define Actions as pure intent functions
const actions = {
  increment: () => model.increment(),
};

// Using an action
actions.increment();
```

### View - Reactive UI Attributes

Views are reactive Zustand stores that transform Model state into
ready-to-spread UI attributes. They provide a declarative mapping from Model
methods to UI properties.

```ts
// Create views that connect UI events to Actions
const countView = createView(
  "count",
  composeFrom(
    // Select from Model for state-derived attributes
    {
      source: model,
      select: {
        "data-count": "getCount",
      },
    },
    // Select from Actions for event handlers
    {
      source: actions,
      select: {
        onClick: "increment",
      },
    },
  ),
);
```

### Hooks - Cross-cutting Concerns

Hooks provide a system to intercept Model method calls for cross-cutting
concerns. They can modify arguments, transform results, or prevent execution.

```ts
// Create hooks by composing from Model sources
const { hooks } = createHooks(
  composeFrom({
    source: model,
    select: {
      increment: {
        before: (args) => {
          console.log("Before increment");
          return { args };
        },
        after: (result, args) => {
          console.log("After increment");
          return { result };
        },
      },
    },
  }),
);
```

---

## 4. Progressive Examples

### Simple Component Example

A basic counter component implementation using Lattice:

```ts
// Create a counter lattice
const createCounter = () => {
  // Create private state store
  const countState = create(() => ({ count: 0 }));

  // Create Model with subscription to private store
  const { model } = createModel(
    withStoreSubscribe(countState, (state) => ({
      count: state.count,
    })),
  )((set, get, selectedState) => ({
    getCount: () => selectedState.count,
    increment: () =>
      countState.setState((state) => ({ count: state.count + 1 })),
    decrement: () =>
      countState.setState((state) => ({ count: state.count - 1 })),
  }));

  // Define Actions as pure intent functions
  const actions = {
    increment: () => model.increment(),
    decrement: () => model.decrement(),
    handleButtonClick: (actionType) =>
      actionType === "increment" ? actions.increment() : actions.decrement(),
  };

  // Create views that connect UI events to Actions
  const counterView = createView(
    "counter",
    composeFrom(
      // Select from Model for state-derived attributes
      {
        source: model,
        select: {
          "data-count": "getCount",
          "aria-live": "polite",
        },
      },
    ),
  );

  const buttonView = createView(
    "button",
    composeFrom(
      // Select from Actions for event handlers
      {
        source: actions,
        select: {
          onClick: "handleButtonClick", // Maps to actions.handleButtonClick(params.action)
        },
      },
    ),
  );

  // Return composed lattice
  return createLattice(
    "counter",
    {
      model,
      actions,
      view: mergeViews(counterView, buttonView),
    },
  );
};

// Usage in a React component:
function Counter() {
  const counter = createCounter();

  const counterProps = useStore(
    counter.view.counter,
    (viewStore) => viewStore.get(),
  );

  const incrementProps = useStore(
    counter.view.button,
    (viewStore) => viewStore.get({ action: "increment" }),
  );

  const decrementProps = useStore(
    counter.view.button,
    (viewStore) => viewStore.get({ action: "decrement" }),
  );

  return (
    <div {...counterProps}>
      <button {...decrementProps}>-</button>
      <span>{counter.model.getCount()}</span>
      <button {...incrementProps}>+</button>
    </div>
  );
}
```

### Medium Complexity Example

A todo list with filtering capabilities:

```ts
// Create a todo list lattice
const createTodoList = () => {
  // Create private state store
  const todoState = create(() => ({
    todos: [],
    filter: "all",
  }));

  // Create Model with subscription to private store
  const { model } = createModel(
    withStoreSubscribe(todoState, (state) => ({
      todos: state.todos,
      filter: state.filter,
    })),
  )((set, get, selectedState) => ({
    getTodos: () => selectedState.todos,
    getFilteredTodos: () => {
      const filter = selectedState.filter;
      const todos = selectedState.todos;

      if (filter === "all") return todos;
      if (filter === "completed") return todos.filter((todo) => todo.completed);
      if (filter === "active") return todos.filter((todo) => !todo.completed);
      return todos;
    },
    getFilter: () => selectedState.filter,
    isTodoCompleted: (id) => {
      const todo = selectedState.todos.find((t) => t.id === id);
      return todo ? todo.completed : false;
    },
    addTodo: (text) => {
      todoState.setState((state) => ({
        todos: [...state.todos, { id: Date.now(), text, completed: false }],
      }));
    },
    toggleTodo: (id) => {
      todoState.setState((state) => ({
        todos: state.todos.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        ),
      }));
    },
    setFilter: (filter) => {
      todoState.setState({ filter });
    },
  }));

  // Define Actions as pure intent functions
  const actions = {
    addTodo: (text) => model.addTodo(text),
    toggleTodo: (id) => model.toggleTodo(id),
    setFilter: (filter) => model.setFilter(filter),
  };

  // Create views
  const todoListView = createView(
    "todoList",
    composeFrom({
      source: model,
      select: {
        "aria-label": () => "Todo List",
        "data-count": () => model.getFilteredTodos().length,
      },
    }),
  );

  const todoItemView = createView(
    "todoItem",
    composeFrom(
      {
        source: model,
        select: {
          "aria-checked": "isTodoCompleted", // Maps to model.isTodoCompleted(params.id)
        },
      },
      {
        source: actions,
        select: {
          onClick: "toggleTodo",
        },
      },
    ),
  );

  // Return composed lattice
  return createLattice(
    "todoList",
    {
      model,
      actions,
      view: mergeViews(todoListView, todoItemView),
    },
  );
};
```

### Complex Component Example

The basic pattern for creating a complex lattice:

```ts
// Factory function that returns a lattice composer
export const createFeature = () => {
  // Returns a function that takes a base lattice and returns an enhanced lattice
  return (baseLattice) => {
    // Create private state store
    const featureState = create(() => ({
      count: 0,
      active: false,
      items: [],
    }));

    // Create derived store with subscription to private store
    const derivedStore = create(
      withStoreSubscribe(featureState, (featureStateObj) => ({
        // Select properties to subscribe to
        count: featureStateObj.count,
        active: featureStateObj.active,
      })),
    )((set, get, selectedState) => ({
      // Use subscribed values plus add new state/methods
      derivedCount: selectedState.count * 2,
      isActive: selectedState.active,
      toggle: () =>
        featureState.setState((state) => ({ active: !state.active })),
    }));

    // Define Actions - pure intent functions
    const actions = {
      increment: () => model.increment(),
      toggleActive: () => model.toggleActive(),
      addItem: (item) => model.addItem(item),
    };

    // Create Model with hooks system, with explicit subscription chain
    const { model, hooks } = createModel(
      // Compose subscriptions with explicit chain
      withStoreSubscribe(featureState, (featureStateObj) => ({
        // Subscribe to feature store
        items: featureStateObj.items,
      })),
    )(
      withStoreSubscribe(derivedStore, (derivedState) => ({
        // Subscribe to derived store
        isActive: derivedState.isActive,
        derivedCount: derivedState.derivedCount,
      })),
    )((set, get, featureSelectedState, derivedSelectedState) => ({
      // Final Model with access to subscribed values from both sources
      getCount: () => derivedSelectedState.derivedCount,
      isActive: () => derivedSelectedState.isActive,
      getItems: () => featureSelectedState.items,

      // Methods that mutate private stores
      increment: () => {
        const currentCount = featureState.getState().count;
        featureState.setState({ count: currentCount + 1 });
      },

      toggleActive: () => derivedStore.getState().toggle(),

      addItem: (item) => {
        featureState.setState((state) => ({
          items: [...state.items, item],
        }));
      },
    }));

    // Create views for UI elements with subscription to Model
    const featureView = createView(
      withView(baseLattice, "uiPart")(
        withStoreSubscribe(model, (modelState) => ({
          // Subscribe to Model store
          isActive: modelState.isActive(),
          count: modelState.getCount(),
        })),
      )((set, get, store, selectedState) => ({
        partName: "uiPart",
        get: (params) => ({
          // DOM and ARIA attributes derived from Model state
          "aria-checked": selectedState.isActive,
          "data-count": selectedState.count,
          // Connect UI events to Actions
          onClick: () => actions.toggleActive(),
          // Extend base views when needed
          ...store.getBaseView(params),
        }),
      })),
    );

    // Hook into base lattice if needed
    baseLattice.hooks.before("someMethod", () => {
      // Interception logic
    });

    // Return composed lattice
    return createLattice(
      "featureName",
      withLattice(baseLattice)({
        model,
        actions,
        hooks,
        view: mergeViews(featureView),
      }),
    );
  };
};
```

---

## 5. Composition Patterns

### Store Subscription Patterns

#### Pattern 1: Single Store Subscription

Simple direct subscription from a store with Actions:

```ts
// Create private store
const countState = create(() => ({ count: 0 }));

// Create Model with subscription to private store
const { model } = createModel(
  withStoreSubscribe(countState, (state) => ({
    count: state.count,
  })),
)((set, get, selectedState) => ({
  getCount: () => selectedState.count,
  increment: () => countState.setState((state) => ({ count: state.count + 1 })),
}));

// Define Actions as pure intent functions
const actions = {
  increment: () => model.increment(),
};
```

#### Pattern 2: Explicit Subscription Chain

Subscribe to multiple stores with explicit chaining:

```ts
// Multiple source stores
const userState = create(() => ({ name: "Guest", loggedIn: false }));
const itemsState = create(() => ({ items: [] }));

// Model with explicit subscription chain
const { model } = createModel(
  // First subscription
  withStoreSubscribe(userState, (userStateObj) => ({
    userName: userStateObj.name,
    isLoggedIn: userStateObj.loggedIn,
  })),
)(
  // Second subscription
  withStoreSubscribe(itemsState, (itemsStateObj) => ({
    items: itemsStateObj.items,
  })),
)((set, get, userSelectedState, itemSelectedState) => ({
  // Methods using multiple stores with clear source origin
  canAddItems: () => userSelectedState.isLoggedIn,
  getUserItems: () => ({
    user: userSelectedState.userName,
    items: itemSelectedState.items,
  }),
}));
```

#### Pattern 3: Layered Subscriptions

Build dependency chains with explicit subscriptions:

```ts
// Base store
const dataState = create(() => ({ value: 10 }));

// First derivative with subscription to base
const multiplierStore = create(
  withStoreSubscribe(dataState, (state) => ({
    baseValue: state.value,
  })),
)((set, get, selectedState) => ({
  multiplier: 2,
  result: selectedState.baseValue * get().multiplier,
  setMultiplier: (m) =>
    set((state) => ({
      multiplier: m,
      result: selectedState.baseValue * m,
    })),
}));

// Second derivative with subscription to first derivative only
const formatterStore = create(
  withStoreSubscribe(multiplierStore, (state) => ({
    value: state.result,
  })),
)((set, get, selectedState) => ({
  formatted: `Value: ${selectedState.value}`,
  // Updates when multiplierStore updates
}));
```

### Feature Composition

#### Pattern 4: Declarative View Composition

Views serve as a declarative transformation layer connecting UI events to
Actions:

```tsx
return (baseLattice) => {
  // Create or enhance Model first
  const { model } = createModel(
    withStoreSubscribe(baseLattice.model, (baseModel) => ({
      baseSelected: baseModel.getSelected(),
      baseItems: baseModel.getItems(),
    })),
  )((set, get, selectedState) => ({
    // Model methods that return data only, never UI views
    getHighlightedItems: () =>
      selectedState.baseItems.filter((item) =>
        selectedState.baseSelected.includes(item.id)
      ),

    isHighlighted: (id) => {
      const highlighted = get().getHighlightedItems();
      return highlighted.includes(id);
    },

    // State mutation methods
    highlightItem: (id) => {
      // Implementation
    },
  }));

  // Define Actions as pure intent functions
  const actions = {
    highlight: (id) => model.highlightItem(id),
  };

  // Declarative view composition
  const view = createView(
    // Base view to extend
    baseLattice.view.listItem,
    // Compose from Model sources
    composeFrom(
      // Select from base view
      {
        source: baseLattice.view.listItem,
        select: {
          // Pass through unchanged
          role: true,
          tabIndex: true,
          // Core behaviors
          onKeyDown: true,
        },
      },
      // Select from Model
      {
        source: model,
        select: {
          // Map Model methods to attributes
          "data-highlighted": "isHighlighted",
        },
      },
      // Connect UI events to Actions
      {
        source: actions,
        select: {
          // Map Actions to event handlers
          onClick: "highlight", // Will call actions.highlight(params.id)
        },
      },
    ),
  );

  // Return enhanced lattice
  return createLattice(
    "featureName",
    withLattice(baseLattice)({
      model,
      actions,
      view: mergeViews(view),
    }),
  );
};
```

This creates a clear separation of concerns following the SAM pattern:

```
┌─────────────────┐
│                 │     1. User interactions trigger actions
│     Actions     │
│                 │
└─────┬───────────┘
      │
      │ (pure intent)
      │
      ▼
┌─────────────────┐
│                 │     2. Business logic & state manipulation
│     Model       │
│                 │
└─────┬───────────┘
      │
      │ (data only)
      │
      ▼
┌─────────────────┐
│                 │     3. Transform data to UI attributes
│    View         │
│                 │
└─────┬───────────┘
      │
      │ (UI attributes)
      │
      ▼
┌─────────────────┐
│                 │     4. Render UI elements
│  Components     │
│                 │
└─────────────────┘
```

---

## 6. Usage Patterns

### Instance Creation and Management

Creating and using lattice instances:

```ts
// Create feature lattices
const selection = createSelection();
const dragAndDrop = createDragAndDrop();

// Compose multiple features into a tree instance
const treeA = createTree().use(selection).use(dragAndDrop);

// Create independent instances with different features
const treeB = createTree().use(selection); // Selection only

// In a React component:
function TreeNode({ id }) {
  // Access state through selectors
  const isSelected = useStore(
    treeA.model,
    (state) => state.isSelected(id),
  );

  // Access actions directly
  const { selectNode } = useStore(
    treeA.actions,
    (actions) => actions,
  );

  // Get ready-to-spread view
  const view = useStore(
    treeA.view.treeItem,
    (viewStore) => viewStore.get({ id }),
  );

  return (
    <div {...view}>
      {/* You can also use actions directly in event handlers */}
      <button onClick={() => selectNode(id)}>Select</button>
    </div>
  );
}

// Add instance-specific hooks
treeA.hooks.after("selectNode", (id) => {
  console.log(`Selected node ${id} in treeA`);
});

// Direct Action dispatch pattern
treeA.actions.selectNode("node-1");
```

Each instance maintains isolated state with proper store synchronization.

### Direct Action Dispatch

Lattice provides direct access to Actions without requiring getters:

```ts
// ✅ Direct Action dispatch (preferred)
selectionActions.selectNode(id, multi);
dragActions.startDrag(id);

// Actions delegate to Model methods
// ✅ Direct Model access also available when needed
selectionModel.isSelected(id); // Read-only selector
```

This pattern:

- Enforces separation of concerns
- Creates cleaner, more traceable code
- Follows the SAM pattern
- Improves testability and debugging

### Error Handling

```ts
// Create Model with error handling
const { model } = createModel(
  withStoreSubscribe(todoState, (state) => ({
    todos: state.todos,
  })),
)((set, get, selectedState) => ({
  getTodo: (id) => {
    const todo = selectedState.todos.find((t) => t.id === id);
    if (!todo) {
      throw new Error(`Todo with id ${id} not found`);
    }
    return todo;
  },

  // Safe version with error handling
  getTodoSafe: (id) => {
    try {
      return {
        data: get().getTodo(id),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error.message,
      };
    }
  },

  // Using Result pattern
  updateTodo: (id, updates) => {
    try {
      const todo = get().getTodo(id);
      todoState.setState((state) => ({
        todos: state.todos.map((t) => t.id === id ? { ...t, ...updates } : t),
      }));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
}));
```

---

## 7. Advanced Topics

### Action System

The Action system in Lattice implements the SAM pattern's approach to state
management:

```
┌────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│                │     │                   │     │                    │
│    Actions     │────▶│  Model (business  │────▶│  State (private    │
│ (pure intent)  │     │    logic)         │     │    stores)         │
│                │     │                   │     │                    │
└────────┬───────┘     └───────────────────┘     └────────────────────┘   
         ▲                                                 │              
         │                                                 │              
         │                                                 ▼              
┌────────┴───────┐                               ┌─────────────────────┐
│                │                               │                     │
│ View (UI       │◀──────────────────────────────│ Updated State       │
│ attributes)    │                               │ (reactive)          │
│                │                               │                     │
└────────────────┘                               └─────────────────────┘
```

#### Creating and Using Actions

```tsx
// Define Actions as plain object of functions
const treeActions = {
  selectNode: (id, multi = false) => treeModel.selectNode(id, multi),
  expandNode: (id) => treeModel.expandNode(id),
  collapseNode: (id) => treeModel.collapseNode(id),
  moveNode: (id, targetId) => treeModel.moveNode(id, targetId),
};

// Create views that connect UI events to Actions
const treeItemView = createView(
  "treeItem",
  composeFrom(
    // Select from Model for state-derived attributes
    {
      source: treeModel,
      select: {
        "aria-selected": "isSelected",
        "aria-expanded": "isExpanded",
      },
    },
    // Select from Actions for event handlers
    {
      source: treeActions,
      select: {
        onClick: "selectNode", // Maps to treeActions.selectNode(params.id, event)
        onDoubleClick: "expandNode", // Maps to treeActions.expandNode(params.id)
      },
    },
  ),
);

// In a component:
function TreeItem({ lattice, id }) {
  const view = useStore(
    lattice.view.treeItem,
    (viewStore) => viewStore.get({ id }),
  );

  // Can also access actions directly if needed
  const { moveNode } = useStore(
    lattice.actions,
    (actions) => actions,
  );

  return <div {...view}>Item Content</div>;
}
```

### View System

The View system in Lattice bridges state management and UI rendering:

```
┌────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│                │     │                   │     │                    │
│ Private States │────▶│  Model (getters & │────▶│  View (reactive    │
│ (state stores) │     │    mutations)     │     │   UI attributes)   │
│                │     │                   │     │                    │
└────────────────┘     └───────────────────┘     └─────────┬──────────┘   
                                                           │              
                                                           │              
                                                           ▼              
                                              ┌──────────────────────────┐
                                              │                          │
                                              │ React/Vue/etc Components │
                                              │  (spread view on els)    │
                                              │                          │
                                              └──────────────────────────┘
```

#### Creating and Using Views

```tsx
// Create views by composing from Model and Actions
const treeItemView = createView(
  // First argument: Base view or string namespace
  "treeItem",
  // Middleware for composing from stores
  composeFrom(
    // Select from Model for state-derived attributes
    {
      source: model,
      select: {
        "aria-selected": "isSelected", // Maps to model.isSelected(params.id)
        "aria-expanded": "isExpanded", // Maps to model.isExpanded(params.id)
        "aria-disabled": "isDisabled", // Maps to model.isDisabled(params.id)
      },
    },
    // Select from Actions for event handlers
    {
      source: actions,
      select: {
        onClick: "select", // Maps to actions.select(params.id, event)
        onKeyDown: "handleKeyDown", // Maps to actions.handleKeyDown(params.id, event)
      },
    },
  ),
);

// Using withView to compose with base lattice
const enhancedTreeItemView = createView(
  // First argument defines the base view to extend
  baseLattice.view.treeItem,
  // Compose from multiple sources
  composeFrom(
    // Select from base view
    {
      source: baseLattice.view.treeItem,
      select: {
        // Pass through these properties unchanged
        tabIndex: true,
        role: true,
        // Remap property names
        "onClick": "onBaseClick",
      },
    },
    // Select from Model
    {
      source: model,
      select: {
        // Additional attributes
        "data-highlighted": "isHighlighted",
        onFocus: "handleFocus",
      },
    },
  ),
);

// In a component:
function TreeItem({ lattice, id }) {
  const view = useStore(
    lattice.view.treeItem,
    (viewStore) => viewStore.get({ id }),
  );

  return <div {...view}>Item Content</div>;
}
```

### Hooks System

The hooks system enables interception and modification of Model method calls
using a declarative pattern that mirrors the View system:

```ts
// Create hooks by composing from multiple Model sources
const { hooks } = createHooks(
  composeFrom(
    // Select from Model
    {
      source: model,
      select: {
        // Define hooks for Model methods
        selectNode: {
          // Before hook - runs before method execution
          before: (args) => {
            const [id, multi] = args;
            console.log(`About to select ${id}`);
            // Return modified arguments or false to prevent execution
            return { args: [id, true] }; // Force multi-select
          },
          // After hook - runs after method execution
          after: (result, args) => {
            const [id] = args;
            console.log(`Selected ${id}`);
            // Return modified result or false to prevent further hooks
            return { result };
          },
        },
        // Another method to hook into
        expandNode: {
          before: (args) => {
            // Logic here
            return { args };
          },
        },
      },
    },
    // Hook into methods from another source
    {
      source: dragAndDropModel,
      select: {
        startDrag: {
          before: (args) => {
            // Logic for drag start
            return { args };
          },
        },
      },
    },
  ),
);

// Composing hooks in a lattice
const composedLattice = createLattice(
  "selection",
  withLattice(baseLattice)({
    model,
    view: mergeViews(view),
    hooks: mergeHooks(hooks),
  }),
);
```

### Framework Adapters

```tsx
// React adapter for Lattice
function useLatticeView(lattice, viewName, params = {}) {
  return useStore(
    lattice.view[viewName],
    (viewStore) => viewStore.get(params),
  );
}

function useLatticeModel(lattice, selector) {
  return useStore(lattice.model, selector);
}

function useLatticeActions(lattice) {
  return useStore(lattice.actions, (actions) => actions);
}

// React component using the adapter
function TreeItem({ lattice, id }) {
  const view = useLatticeView(lattice, "treeItem", { id });
  // Use model methods directly instead of inline logic
  const isSelected = useLatticeModel(lattice, (state) => state.isSelected(id));
  const { selectNode } = useLatticeActions(lattice);

  // Move formatting logic to model or component logic
  const selectionIndicator = useLatticeModel(
    lattice,
    (state) => state.getSelectionIndicator(id),
  );

  return (
    <div {...view}>
      {selectionIndicator} Item {id}
    </div>
  );
}

// Vue adapter would look similar but use Vue's reactivity system
```

---

## 8. API Reference

### createLattice

```ts
function createLattice(
  name: string,
  options: {
    model: ZustandStore;
    actions: Record<string, Function>;
    hooks?: HooksObject;
    view?: ViewObject;
  },
): Lattice;
```

### createModel

```ts
function createModel(
  ...subscriptions: Array<(set, get, ...selectedState) => ModelDefinition>
): { model: ZustandStore; hooks: HooksObject };
```

### createView

```ts
function createView(
  base: string | ZustandStore,
  composer: ViewComposer,
): ViewObject;
```

### withStoreSubscribe

```ts
function withStoreSubscribe<T, S>(
  store: ZustandStore<T>,
  selector: (state: T) => S,
): (next: (set, get, selectedState: S) => any) => any;
```

### composeFrom

```ts
function composeFrom(
  ...sources: Array<{
    source: ZustandStore | Record<string, Function>;
    select: Record<string, string | boolean | Function>;
  }>
): ViewComposer;
```

### mergeViews

```ts
function mergeViews(...views: ViewObject[]): ViewObject;
```

### mergeHooks

```ts
function mergeHooks(...hooks: HooksObject[]): HooksObject;
```
