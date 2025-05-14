# Lattice

A **headless component framework** built on Zustand. Lattice lattices are both
the declarative contract and the actual API for your component—defining,
composing, and enforcing the API surface at both the type and runtime level. Its
core compositional mechanism is a fluent composition pattern with `.with()`
method, enabling contract preservation, extensibility, and best-in-class
developer experience. React‑first DX with a framework‑agnostic core.

---

## Lattice: Declarative Contract and API

A **lattice** is both the declarative contract and the actual API for your
component. When you define or compose a lattice, you are specifying (at the type
level) and constructing (at runtime) the API surface that consumers will use.
The lattice is not just a blueprint—it is the API itself.

- **Composing or narrowing** any part (e.g., model, state) changes the contract
  and the API surface.
- **Omitting a callback** passes through the dependency's contract/API
  unchanged.
- **Providing a callback** allows you to select, rename, or filter the API
  surface, and the resulting lattice exposes only what you specify.
- **Lattice creation enforces contract consistency**: All parts (model, state,
  actions, view) must agree on the contract/API, or you get a type error.

---

## Fluent Composition Pattern

Lattice's core compositional mechanism is a fluent composition pattern, used for
models, states, actions, and views. This pattern is built around the chainable
`.with()` method for composition and the `prepare()` function for finalization.
This separation enables clean contract preservation, extensibility, and a clear
distinction between composition and finalization phases.

### Anatomy and Terminology

The fluent composition pattern consists of three distinct phases:

- **Creation Phase**: Factory functions like `createModel()` and `createState()`
  create base model instances that serve as the starting point for composition.
  These base models define the initial state and behavior.

  ```typescript
  // Base model creation
  const counterModel = createModel(({ get, set }) => ({
    count: 10,
  }));
  ```

- **Composition Phase**: The `.with()` method extends the model by adding new
  properties or behaviors. This method takes a callback function that receives
  helpers (like `get()`) for accessing the model's state, and returns an object
  with the new properties to add. The `.with()` method can be chained multiple
  times to progressively enhance the model.

  ```typescript
  // Extensions express what they're adding to the model
  const withStats = compose(counterModel).with<{ doubleCount: () => number }>((
    { get },
  ) => ({
    doubleCount: () => get().count * 2,
  }));

  const withLogger = compose(withStats).with<{ logCount: () => void }>((
    { get },
  ) => ({
    logCount: () => console.log(`Current count: ${get().count}`),
  }));
  ```

- **Finalization Phase**: The `prepare()` function marks the end of the
  composition phase for a specific lattice, preventing further changes within
  that lattice definition. Even after finalization, the model can still be used
  in compositions for other lattices.

  ```typescript
  // Prepare the finalized model
  const finalModel = prepare(withLogger);
  ```

This pattern provides a clear, chainable API that makes the composition intent
explicit and improves code readability while preserving type safety.

#### Summary Table

| Phase        | Method/Function | Role/Responsibility                      | Example                                                                                          |
| ------------ | --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Creation     | `createModel()` | Create base model instance               | `const counterModel = createModel(({ get, set }) => ({ count: 0 }))`                             |
| Composition  | `.with()`       | Add new properties, extend functionality | `const enhanced = compose(counterModel).with(({ get }) => ({ doubled: () => get().count * 2 }))` |
| Finalization | `prepare()`     | Finalize for a specific lattice          | `const final = prepare(enhanced)`                                                                |

### Rationale

- **Fluent Composition**: Chainable, expressive API for model composition that
  makes composition intent explicit and improves code readability.
- **Clear Phase Boundaries**: Distinct creation, composition, and finalization
  phases enable clean separation of concerns and prevent unintended
  modifications.
- **Type Safety**: Type information is preserved across all composition phases,
  ensuring comprehensive TypeScript support throughout the model hierarchy.
- **Reference Preservation**: Property references work across model boundaries,
  allowing models to access properties defined in other models.
- **Compositional Approach**: Models are composable units for Zustand stores
  that can be combined through the chainable API before finalization.

This pattern is core to Lattice's composability, contract preservation, and
best-in-class developer experience.

---

## 1. Introduction

Lattice is a headless component framework that redefines composability and
contract safety for UI architecture. In Lattice, a **lattice** is both the
declarative contract and the actual API for your component—defining, composing,
and enforcing the API surface at both the type and runtime level. This ensures
that every composition or extension of a lattice is type-safe,
contract-preserving, and explicit.

Lattice's core compositional mechanism is a fluent composition pattern, with
`.with()` for composition and `prepare()` for finalization. This pattern is used
for models, states, actions, and views to provide a chainable, expressive API
for building component features. This approach guarantees that all parts of a
lattice (model, state, actions, view) remain consistent and extensible, while
preserving the original contract and type safety throughout.

Lattice implements the SAM (State-Action-Model) pattern on top of Zustand,
providing a familiar, React-first developer experience with a framework-agnostic
core.

### Core Value Propositions

- **Declarative Contract-as-API**: Every lattice is both the contract and the
  API, enforced at type and runtime.
- **Fluent Composition Pattern**: Chainable API with `.with()` and `prepare()`
  methods for clear, expressive composition and finalization.
- **Type-Safe Composability**: All compositions are type-checked; contract
  violations are surfaced as type errors.
- **SAM Architecture**: Actions → Model → State → View, with strict separation
  of concerns.
- **Unified Model**: Getters and mutations in a single Model object with
  auto-generated hooks.
- **Factory Pattern**: Factories define reusable patterns, only instantiating
  stores when needed.
- **Instance Isolation**: Multiple independent instances with proper state
  isolation.
- **Zustand Foundation**: Familiar DX, dev-tools time-travel, no custom state
  engine.

### When to Use Lattice vs. Plain Hooks

| When plain hooks shine                         | Where they falter                                                                                      | How Lattice closes the gap                                                                    |
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

| Terminology | Meaning                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **Model**   | The primary unit of composition, containing state and business logic. Defines the contract for state and mutations. |
| **Actions** | Pure intent functions representing user operations (WHAT), delegating to model methods (HOW).                       |
| **State**   | Public selectors providing read access to the model, forming part of the contract/API surface.                      |
| **View**    | Pure, reactive representations that transform state and actions into ready-to-spread UI attributes.                 |

> Together, these make up a composable **lattice**—the declarative contract and
> the actual API for your component.

### Mental Model & Flow

```
                   ┌───────── Contract/Reactive Models ─────────┐
                   ▼                  ▼                        ▼
View event ──▶ Actions ──▶ Model Mutation ──▶ State/View update ──▶ UI re‑render
```

- **One-way data flow**: Follows the SAM (State-Action-Model) pattern.
- **Actions**: Pure intent (WHAT), triggering state changes via the model.
- **Model**: Contains business logic and state (HOW); the contract
  source-of-truth.
- **State**: Read-only selectors, forming the public API surface.
- **View**: Pure, reactive mappings from state/actions to UI attributes.
- **Lattice**: Exposes models, actions, state, and views for composition, while
  only exposing state and views for consuming.
- **Contract Enforcement**: Every composition or extension is type-checked;
  contract violations are surfaced as type errors.

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

- Only the derived State and View(s) are available via the Public API for
  consumption (e.g., by UI components).
- Models and actions are available for composition—when building new lattices or
  extensions—but are not exposed to consumers directly.
- Composing lattices together allows _composition_ of every part, but always
  through explicit contract selection and extension.
- Models are the source-of-truth, combining state and behavior, but are never
  exposed directly to consumers.
- The contract is preserved and enforced at every composition boundary.

### Factory-Based Composition with Fluent API

Lattice uses a factory-based composition model, built around a fluent
composition pattern with chainable methods:

1. **Composition Phase**: Factory functions (e.g., `createModel`, `createState`)
   create base models that can be extended with the `.with()` method (via the
   `compose()` function), which adds new properties or behaviors to the model.
2. **Finalization Phase**: The `prepare()` function finalizes a specific model
   composition, preventing further changes within a specific lattice definition.
3. **Instantiation Phase**: The actual Zustand stores are only created when the
   lattice itself is instantiated for use. Even after calling `prepare()`, the
   finalized models can still be used in composition for other lattices.
4. This separation enables:
   - Type-safe contract enforcement across all compositions
   - Clean separation between contract composition and logic extension
   - Lazy, efficient instantiation of enhanced lattices

```typescript
// Core lattice with minimal functionality
const createCoreLattice = () => {
  // Create model with the fluent API
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
  }));

  // Create actions
  const actions = createActions(({ mutate }) => ({
    increment: mutate(model, "increment"),
  }));

  // Create state
  const state = createState(({ derive }) => ({
    count: derive(model, "count"),
  }));

  // Return lattice with finalized components
  return createLattice("core", {
    model: prepare(model),
    actions: prepare(actions),
    state: prepare(state),
  });
};

// Usage: Create core lattice immediately
const coreLattice = createCoreLattice();

// Then later, dynamically import an enhancement
// In enhancementModule.js:
export const enhanceWithFeature = (baseLattice) => {
  // Enhance the model by accessing it from the base lattice
  const model = compose(baseLattice.model).with(({ get }) => ({
    // Add new functionality
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
  }));

  // First finalize the model
  const finalModel = prepare(model);

  // Enhance the actions with reference to the finalized model
  const actions = compose(baseLattice.actions).with(({ mutate }) => ({
    // mutate references the finalized model
    incrementTwice: mutate(finalModel, "incrementTwice"),
  }));

  // Return a new lattice that composes with the base lattice
  return createLattice(
    "enhanced",
    withLattice(baseLattice)({
      model: finalModel,
      actions: prepare(actions),
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

### Model – Primary Unit of Composition

Models are the fundamental building blocks in Lattice, encapsulating both state
and business logic. They define the contract for state and mutations, and are
available for composition when building new lattices or extensions. Models are
**not** exposed to consumers—only to composers.

```typescript
// Create a standalone model with state and methods
const counterModel = createModel(({ set, get }) => ({
  // Internal state
  count: 0,

  // State mutations
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),

  // State selectors
  getCount: () => get().count,
}));
// Model is a factory until finalized with prepare()
```

#### Model Composition (Fluent Pattern)

Models are composed using the fluent composition pattern:

- **Base model**: Created with `createModel()`
- **Composition**: Extended with `.with()` via the `compose()` function to add
  new properties or behaviors
- **Finalization**: Completed with `prepare()` to prevent further changes

```typescript
// Base model
const counterModel = createModel(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Add new behavior with .with()
const enhancedModel = compose(counterModel).with(({ get }) => ({
  incrementTwice: () => {
    get().increment();
    get().increment();
  },
}));

// Finalize the model
const finalModel = prepare(enhancedModel);
```

### Actions – Pure Intent Functions

Actions are pure intent functions representing WHAT should happen, delegating to
model methods (HOW). Actions are available for composition, but are **not**
exposed to consumers—only to composers. They follow the fluent composition
pattern for contract preservation and extension.

```typescript
const actions = createActions(({ mutate }) => ({
  increment: mutate(model, "increment"),
  doubleIncrement: mutate(model, "incrementTwice"),
}));

const enhancedActions = compose(actions).with(({ mutate }) => ({
  incrementThrice: mutate(model, "incrementThrice"),
}));

// Finalize the actions
const finalActions = prepare(enhancedActions);
```

### State – Public Selectors

State selectors provide read access to the model and form part of the public API
surface. State is available for both composition and consumption. State
factories use the fluent composition pattern for contract selection and
extension.

```typescript
// Base state
const state = createState(({ derive }) => ({
  count: derive(model, "count"),
  countPlusOne: derive(model, "count", (count) => count + 1),
  isPositive: () => get().count > 0,
}));

// Enhanced state with additional properties
const enhancedState = compose(state).with(({ get, derive }) => ({
  doubled: derive(model, "count", (count) => count * 2),
  formatted: () => `Count: ${get().count}`,
}));

// Finalize the state
const finalState = prepare(enhancedState);
```

### View – Reactive UI Attributes

Views are pure, reactive representations that transform state and actions into
ready-to-spread UI attributes. Views are available for both composition and
consumption. They follow the fluent composition pattern for contract selection
and extension, and are typically namespaced within lattices.

```typescript
// Inside a lattice definition
const createMyLattice = () => {
  // Base view
  const counterView = createView(({ derive }) => ({
    "data-count": derive(state, "count"),
    "aria-live": "polite",
  }));

  // Button view
  const buttonView = createView(({ dispatch }) => ({
    onClick: dispatch(actions, "increment"),
  }));

  // Return lattice with namespaced views
  return createLattice({
    model: prepare(model),
    actions: prepare(actions),
    state: prepare(state),
    view: {
      counter: prepare(counterView),
      button: prepare(buttonView),
    },
  });
};

// When composing with another lattice
const createEnhancedLattice = (baseLattice) => {
  // Access and compose with a namespaced view
  const enhancedCounterView = compose(baseLattice.view.counter).with((
    { derive },
  ) => ({
    "aria-label": "Enhanced counter",
    "data-description": derive(state, "formatted"),
  }));

  // Composition preserves the namespaces
  return createLattice({
    // Inherit from base lattice
    ...withLattice(baseLattice)({
      // Provide the enhanced view with the same namespace
      view: {
        counter: prepare(enhancedCounterView),
      },
    }),
  });
};
```

```ts
function enhanceLattice(baseLattice) {
  // ...user-composition logic

  return createLattice({
    // pass in a composed model
    model: prepare(composedModel),
    // pass-through by passing the lattice, and we take care of the pass-through under the hood
    state: baseLattice,
    view: {
      composedView: prepare(composedView),
      passThroughView: prepare(use(baseLattice, "passThroughView")),
      // a way to spread views
      ...spreadViews(baseLattice),
    },
    // pass-through
    actions: baseLattice,
  });
}
```

> **Summary:**
>
> - **Models and actions**: Available for composition only (not exposed to
>   consumers).
> - **State and views**: Available for both composition and consumption (public
>   API surface).
> - All building blocks use the fluent composition pattern with `.with()` (via
>   `compose()`) and `prepare()` for contract preservation and extensibility.
> - Views are typically namespaced within lattices, allowing for organized
>   component composition.
> - Contract enforcement applies at every boundary—type errors surface on
>   contract violations.

---

## 4. Progressive Examples

### Simple Component Example

A basic counter component implementation using Lattice with the fluent
composition pattern and contract-as-API:

```typescript
// Create a counter lattice
const createCounter = () => {
  // Create counter model with state and behavior
  const model = createModel(({ set, get }) => ({
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

  // Finalize the model
  const finalModel = prepare(model);

  // Define Actions
  const actions = createActions(({ mutate }) => ({
    increment: mutate(finalModel, "increment"),
    decrement: mutate(finalModel, "decrement"),
    incrementTwice: mutate(finalModel, "incrementTwice"),
  }));

  // Finalize the actions
  const finalActions = prepare(actions);

  // Define public state
  const state = createState(({ derive }) => ({
    count: derive(finalModel, "getCount"),
    countSquared: derive(finalModel, "count", (count) => count * count),
  }));

  // Finalize the state
  const finalState = prepare(state);

  // Create counter view
  const counterView = createView(({ derive }) => ({
    "data-count": derive(finalState, "count"),
    "aria-live": "polite",
  }));

  // Create button views
  const incrementButtonView = createView(({ dispatch }) => ({
    onClick: dispatch(finalActions, "increment"),
  }));

  const decrementButtonView = createView(({ dispatch }) => ({
    onClick: dispatch(finalActions, "decrement"),
  }));

  // Return composed lattice with namespaced views
  return createLattice(
    "counter",
    {
      model: finalModel,
      actions: finalActions,
      state: finalState,
      view: {
        counter: prepare(counterView),
        incrementButton: prepare(incrementButtonView),
        decrementButton: prepare(decrementButtonView),
      },
    },
  );
};
```

### Medium Complexity Example

A todo list with filtering capabilities using the fluent composition pattern and
contract-as-API:

```typescript
const createTodoList = () => {
  // Model with state and behavior
  const model = createModel(({ set, get }) => ({
    todos: [],
    filter: "all",
    label: "Todo List",
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
    addAndFilterActive: (text) => {
      get().addTodo(text);
      get().setFilter("active");
    },
    _getTodos: () => get().todos,
    _getFilter: () => get().filter,
    getFilteredTodos: () => {
      const todos = get().todos;
      const filter = get().filter;
      if (filter === "all") return todos;
      if (filter === "completed") return todos.filter((todo) => todo.completed);
      if (filter === "active") return todos.filter((todo) => !todo.completed);
      return todos;
    },
    getFilteredTodosCount: () => get().getFilteredTodos().length,
    isTodoCompleted: (id) => {
      const todo = get().todos.find((t) => t.id === id);
      return todo ? todo.completed : false;
    },
  }));

  // Finalize the model
  const finalModel = prepare(model);

  // Actions delegating to model methods
  const actions = createActions(({ mutate }) => ({
    addTodo: mutate(finalModel, "addTodo"),
    toggleTodo: mutate(finalModel, "toggleTodo"),
    setFilter: mutate(finalModel, "setFilter"),
    addAndFilterActive: mutate(finalModel, "addAndFilterActive"),
  }));

  // Finalize the actions
  const finalActions = prepare(actions);

  // Public state with selectors
  const state = createState(({ derive }) => ({
    todos: derive(finalModel, "_getTodos"),
    filter: derive(finalModel, "_getFilter"),
    filteredTodos: derive(finalModel, "getFilteredTodos"),
    filteredTodosCount: derive(finalModel, "getFilteredTodosCount"),
    listLabel: "Todo List",
    isTodoCompleted: derive(finalModel, "isTodoCompleted"),
  }));

  // Finalize the state
  const finalState = prepare(state);

  // Views for UI components
  const todoListView = createView(({ derive }) => ({
    "aria-label": derive(finalState, "listLabel"),
    "data-count": derive(finalState, "filteredTodosCount"),
  }));

  const todoItemView = createView(({ derive, dispatch }) => ({
    "aria-checked": derive(finalState, "isTodoCompleted"),
    onClick: dispatch(finalActions, "toggleTodo"),
  }));

  // Return lattice with namespaced views
  return createLattice(
    "todoList",
    {
      model: finalModel,
      actions: finalActions,
      state: finalState,
      view: {
        list: prepare(todoListView),
        item: prepare(todoItemView),
      },
    },
  );
};
```

### Complex Component Example – Composition

Creating a complex component through factory composition, with contract
enforcement and public API distinction:

```typescript
// Factory function that creates an enhanced lattice from a base lattice
export const createFeature = () => {
  return (baseLattice) => {
    // Create an enhanced model by adding selection and items functionality
    const enhancedModel = compose(baseLattice.model).with(({ get, set }) => ({
      // Selection-related state and behavior
      selected: [],
      highlighted: null,

      // Selection methods
      selectItem: (id, isMulti = false) =>
        set((state) => ({
          selected: isMulti ? [...state.selected, id] : [id],
        })),
      deselectItem: (id) =>
        set((state) => ({
          selected: state.selected.filter((itemId) => itemId !== id),
        })),
      clearSelection: () => set({ selected: [] }),
      isSelected: (id) => get().selected.includes(id),
      getSelected: () => get().selected,

      // Item-related methods that would build upon the base model
      getItemsWithSelection: () => {
        return get().items.map((item) => ({
          ...item,
          selected: get().isSelected(item.id),
        }));
      },

      // Combined behaviors
      selectAndHighlight: (id) => {
        get().selectItem(id);
        set({ highlighted: id });
      },
      isHighlighted: (id) => get().highlighted === id,
    }));

    // Finalize the enhanced model
    const finalModel = prepare(enhancedModel);

    // Create enhanced actions
    const enhancedActions = compose(baseLattice.actions).with(({ mutate }) => ({
      // Add new actions referencing the enhanced model methods
      selectItem: mutate(finalModel, "selectItem"),
      selectAndHighlight: mutate(finalModel, "selectAndHighlight"),
      clearSelection: mutate(finalModel, "clearSelection"),
    }));

    // Finalize the actions
    const finalActions = prepare(enhancedActions);

    // Create enhanced state
    const enhancedState = compose(baseLattice.state).with(({ derive }) => ({
      // Add new state properties derived from the enhanced model
      selected: derive(finalModel, "getSelected"),
      itemsWithSelection: derive(finalModel, "getItemsWithSelection"),
      isSelected: derive(finalModel, "isSelected"),
      isHighlighted: derive(finalModel, "isHighlighted"),
    }));

    // Finalize the state
    const finalState = prepare(enhancedState);

    // Create enhanced view for items
    const enhancedItemView = compose(baseLattice.view.item).with((
      { derive, dispatch },
    ) => ({
      // Add selection-related attributes
      "aria-selected": derive(finalState, "isSelected"),
      "data-highlighted": derive(finalState, "isHighlighted"),
      onClick: dispatch(finalActions, "selectAndHighlight"),
    }));

    // Return enhanced lattice with a single cohesive model
    return createLattice(
      "featureName",
      withLattice(baseLattice)({
        model: finalModel,
        actions: finalActions,
        state: finalState,
        view: {
          item: prepare(enhancedItemView),
        },
      }),
    );
  };
};
```

## 5. The Derive System

The `derive` function allows for creating reactive subscriptions between models,
states, and views:

```typescript
// Create and finalize the model
const model = createModel(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
const finalModel = prepare(model);

// Create and finalize the actions
const actions = createActions(({ mutate }) => ({
  increment: mutate(finalModel, "increment"),
}));
const finalActions = prepare(actions);

// State derives from finalized model
const state = createState(({ derive }) => ({
  // Derive count from finalized model
  count: derive(finalModel, "count"),

  // Derive with transformation
  doubled: derive(finalModel, "count", (count) => count * 2),

  // Derive from model properties with transformation
  status: derive(
    finalModel,
    "count",
    (count) => count > 0 ? "positive" : "zero",
  ),
}));
const finalState = prepare(state);

// Views derive from finalized state and actions
const view = createView(({ derive, dispatch }) => ({
  // Derive attribute from finalized state
  "data-count": derive(finalState, "count"),

  // Derive with transformation
  className: derive(
    finalState,
    "status",
    (status) => `counter counter--${status}`,
  ),

  // Connect to finalized action with dispatch
  onClick: dispatch(finalActions, "increment"),
}));
const finalView = prepare(view);
```

### Composition vs. Deriving

It's important to understand the difference between composition and deriving:

1. **Composition** happens with the `.with()` method to extend an existing
   component:

```typescript
// Composing by extending an existing state
const enhancedState = compose(baseState).with(({ get }) => ({
  // Add new properties
  doubledCount: () => get().count * 2,
}));
```

2. **Deriving** happens when creating reactive subscriptions to finalized
   models/states:
   ```typescript
   // First finalize the model
   const finalModel = prepare(model);

   // Then derive properties from finalized model
   const state = createState(({ derive }) => ({
     // Create reactive subscription to finalized model property
     count: derive(finalModel, "count"),
     formattedCount: derive(finalModel, "count", (count) => `Count: ${count}`),
   }));
   ```

Let's look at a correct full example using the fluent API:

```typescript
// Creating an enhanced lattice from a base lattice
const createEnhancedLattice = (baseLattice) => {
  // Accessing the base lattice's model
  const enhancedModel = compose(baseLattice.model).with(({ get }) => ({
    // Add new properties or behaviors
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
  }));

  // Finalize the model
  const finalModel = prepare(enhancedModel);

  // Enhance the state
  const enhancedState = compose(baseLattice.state).with(({ get, derive }) => ({
    // Derive from finalized model
    doubled: derive(finalModel, "count", (count) => count * 2),
    formattedStatus: () => `Status: ${get().status}`,
  }));

  // Finalize the state
  const finalState = prepare(enhancedState);

  // Enhance the actions
  const enhancedActions = compose(baseLattice.actions).with(({ mutate }) => ({
    // Connect to the finalized model
    incrementTwice: mutate(finalModel, "incrementTwice"),
  }));

  // Create the enhanced lattice with namespaced views
  return createLattice("enhanced", {
    model: finalModel,
    state: finalState,
    actions: prepare(enhancedActions),
    // Views are namespaced at the lattice level
    view: {
      // Enhance the counter view from the base lattice
      counter: prepare(
        compose(baseLattice.view.counter).with(({ derive }) => ({
          "aria-label": "Enhanced counter",
          "data-count": derive(finalState, "doubled"),
        })),
      ),
    },
  });
};
```

## 6. Type Safety & Branding

Lattice uses a sophisticated type system to ensure type safety:

- **Branded Types**: All Lattice components (models, actions, states, views) are
  branded with unique symbols for runtime identification. For example,
  `MODEL_INSTANCE_BRAND` is used to identify model instances.

- **Type Guards**: Functions like `isModelInstance()`, `isStateInstance()`,
  etc., provide runtime type checking to ensure components are of the expected
  type.

- **Generic Inference**: The type system allows types to flow through the
  composition chain with proper inference, ensuring type safety across all
  compositions.

- **Function Overloading**: The composition API handles different component
  types correctly through TypeScript function overloading.

```typescript
// Example of a branded type from the system
type ModelInstance<T> = Branded<
  () => (options: ModelFactoryTools<T>) => T,
  typeof MODEL_INSTANCE_BRAND
>;

// Example of a type guard
export function isModelInstance<T = unknown>(
  value: unknown,
): value is ModelInstance<T> {
  return isBranded(value, MODEL_INSTANCE_BRAND);
}

// Example of composition with type inference
const enhancedModel = compose(baseModel).with<{ doubled: () => number }>(
  ({ get }) => ({
    doubled: () => get().count * 2,
  }),
);
```

This type system ensures that all compositions are type-checked, and contract
violations are surfaced as type errors during development.

## 7. Action System

Actions are pure intent functions that delegate directly to model methods
without containing their own implementation logic:

```typescript
// Model defines all behavior including composite operations
const model = createModel(({ set, get }) => ({
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

// Finalize the model
const finalModel = prepare(model);

// Actions are pure delegates to model methods
const actions = createActions(({ mutate }) => ({
  // Each action directly references a finalized model method
  increment: mutate(finalModel, "increment"),
  reset: mutate(finalModel, "reset"),
  incrementTwice: mutate(finalModel, "incrementTwice"),
  resetAndIncrement: mutate(finalModel, "resetAndIncrement"),
}));

// Enhance actions by composing with the base actions
const enhancedActions = compose(actions).with(({ mutate }) => ({
  // Add new actions that reference finalized model methods
  incrementThrice: mutate(finalModel, "incrementThrice"),
}));

// Finalize the enhanced actions
const finalActions = prepare(enhancedActions);
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

## 8. Asynchronous Operations Pattern

Asynchronous operations follow the same SAM pattern, with state changes flowing
unidirectionally through the system:

```typescript
// Model contains all async logic and loading/error states
const model = createModel(({ set, get }) => ({
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
const actions = createActions(({ mutate }) => ({
  // Actions reference model methods
  fetchUsers: mutate(model, "fetchUsers"),
  fetchUserById: mutate(model, "fetchUserById"),
}));

// State exposes loading/error states reactively
const state = createState(({ derive }) => ({
  users: derive(model, "users"),
  isLoading: derive(model, "loading"),
  error: derive(model, "error"),

  // Derived states
  hasUsers: derive(model, "users", (users) => users.length > 0),
  hasError: derive(model, "error", (error) => error !== null),
}));

// Views reflect loading and error states
const userListView = createView(({ derive }) => ({
  "aria-busy": derive(state, "isLoading"),
  "aria-live": "polite",
  "data-has-error": derive(state, "hasError"),
  "data-error-message": derive(state, "error"),
}));
```

This pattern maintains the SAM architecture's unidirectional data flow while
handling async operations:

1. Actions trigger intent without returning values
2. Models contain all async logic and state management
3. State reactively exposes loading/error conditions
4. Views transform these states into UI attributes
5. Components react to state changes

## Licensing

MIT
