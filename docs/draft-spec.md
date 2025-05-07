# Lattice

A **headless component framework** built on Zustand. Lattice lattices are both
the declarative contract and the actual API for your component—defining,
composing, and enforcing the API surface at both the type and runtime level. Its
core compositional mechanism is a two-phase (composition/extension) function
pattern, enabling contract preservation, extensibility, and best-in-class
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

## Composition and Extension Function Pattern

Lattice's core compositional mechanism is a two-phase function pattern, used for
models, actions, state, and views. While this often appears as a "double
factory," the essential concept is two **separate phases**: one for composition
and one for extension. This separation enables clean contract preservation,
extensibility, and a clear distinction between what is composed and what is
extended.

### Anatomy and Terminology

Each use of this pattern consists of two distinct phases:

- **Composition Phase (composition function, outer)**: Responsible for composing
  and establishing the contract and API surface. The composition function
  selects and maps properties or behaviors from other sources (lattices,
  factories, etc.), determining what is available for further extension.

  The composition function takes two arguments:
  - a **compatible dependency** as the first argument—either:
    - a lattice, or
    - a factory of the same type (e.g., for `createState`, a lattice or a state
      factory).
  - an **optional callback function** as the second argument. This callback
    receives a selectors object (e.g., `{ state, select }`), which provides
    access to select properties from the compatible dependency for composition.
    The purpose of this callback is to allow you to select, map, or rename
    properties from the compatible dependency, and to define the contract and
    API surface for what will be available to the extension phase. If you do not
    provide the callback, the contract from the dependency is used as-is, with
    no additional selection, mapping, or renaming.

  If a lattice is provided, the function will extract the relevant type to be
  provided in the callback (for example, with `createState`, if a lattice is
  passed, it extracts the base state from the lattice for use in the callback).
- **Extension Phase (extension function, inner)**: Responsible for extending,
  deriving, or enhancing the contract and API surface established in the
  composition phase. The extension function uses the composed sources from the
  composition phase to add new properties, derive new values, or otherwise
  augment the API.

**This pattern is sometimes called the "double-function" or "IIFE" pattern, but
in Lattice, these are two distinct phases, each with a clear responsibility.**

#### Example

```ts
const enhancedState = createState(baseLattice, ({ state, select }) => ({
  count: select(state, "count"),
  status: select(state, "status"),
}))(({ get, derive }) => ({
  doubled: derive(model, "count", (count) => count * 2),
  formattedStatus: derive(state, "status", (status) => `Status: ${status}`),
}));
```

- **Composition Function**: Composes `count` and `status` from the base lattice.
- **Extension Function**: Implements `doubled` and `formattedStatus` as new
  derived properties.

#### Summary Table

| Phase       | Function             | Role/Responsibility (first arg: compatible dependency) | Receives                                                           | Example Parameter Object         |
| ----------- | -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------- |
| 1st (outer) | Composition Function | Composition, selection, contract setup                 | compatible dependency (lattice or factory of same type), selectors | `{ state, select }`              |
| 2nd (inner) | Extension Function   | Extension, derivation, enhancement of contract/API     | helpers, composed state                                            | `{ get, set, derive, dispatch }` |

### Rationale

- **Separation of Concerns**: The composition phase handles composition and
  contract, the extension phase handles logic, derivation, and augmentation.
- **Extensibility**: Compose from multiple sources without leaking
  implementation details.
- **Type Safety**: The contract is enforced at the composition phase, while the
  extension phase can safely build on it. Lattice creation enforces that all
  parts (model, state, actions, view) are consistent and compatible, or a type
  error will occur.

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

Lattice's core compositional mechanism is a two-phase (composition/extension)
function pattern, used for models, actions, state, and views. The first phase
(composition) selects, maps, or narrows the contract/API surface from
dependencies; the second phase (extension) derives, augments, or enhances the
contract. This pattern guarantees that all parts of a lattice (model, state,
actions, view) remain consistent and extensible, while preserving the original
contract.

Lattice implements the SAM (State-Action-Model) pattern on top of Zustand,
providing a familiar, React-first developer experience with a framework-agnostic
core.

### Core Value Propositions

- **Declarative Contract-as-API**: Every lattice is both the contract and the
  API, enforced at type and runtime.
- **Two-Phase Composition/Extension**: Clean separation between contract
  composition and extension, ensuring contract preservation and extensibility.
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

### Factory-Based Composition and the Two-Phase Pattern

Lattice uses a factory-based composition model, built around a two-phase
(composition/extension) function pattern:

1. **Composition Phase**: Factory functions (e.g., `createModel`, `createState`)
   take a compatible dependency (lattice or factory) and an optional callback to
   select, map, or rename properties—establishing the contract/API surface for
   extension.
2. **Extension Phase**: The returned function extends or derives new properties,
   augmenting the contract/API surface established in the composition phase.
3. Actual stores are only created when a lattice is instantiated, ensuring
   efficient composition and contract enforcement.
4. This enables:
   - Type-safe contract enforcement across all compositions
   - Clean separation between contract composition and logic extension
   - Lazy, efficient instantiation of enhanced lattices

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

### Model – Primary Unit of Composition

Models are the fundamental building blocks in Lattice, encapsulating both state
and business logic. They define the contract for state and mutations, and are
available for composition when building new lattices or extensions. Models are
**not** exposed to consumers—only to composers.

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

#### Model Composition (Two-Phase Pattern)

Models are composed using the two-phase (composition/extension) pattern:

- **Composition phase**: Select, map, or rename properties from dependencies
  (lattice or model factory) to establish the contract surface.
- **Extension phase**: Extend or derive new properties, augmenting the
  contract/API surface.

```ts
const enhancedModel = createModel(baseModel, ({ model, select }) => ({
  increment: select(model, "increment"),
}))(({ set, get }) => ({
  incrementTwice: () => {
    get().increment();
    get().increment();
  },
}));
```

### Actions – Pure Intent Functions

Actions are pure intent functions representing WHAT should happen, delegating to
model methods (HOW). Actions are available for composition, but are **not**
exposed to consumers—only to composers. They follow the two-phase pattern for
contract preservation and extension.

```ts
const actions = createActions()(({ mutate }) => ({
  increment: mutate(model, "increment"),
  doubleIncrement: mutate(model, "incrementTwice"),
}));

const enhancedActions = createActions(baseLattice, ({ actions, select }) => ({
  increment: select(actions, "increment"),
}))(({ mutate }) => ({
  incrementTwice: mutate(model, "incrementTwice"),
}));
```

### State – Public Selectors

State selectors provide read access to the model and form part of the public API
surface. State is available for both composition and consumption. State
factories use the two-phase pattern for contract selection and extension.

```ts
const state = createState()(({ get, derive }) => ({
  count: derive(model, "count"),
  countPlusOne: derive(model, "count", (count) => count + 1),
  isPositive: () => get().count > 0,
}));

const enhancedState = createState(baseLattice, ({ state, select }) => ({
  count: select(state, "count"),
}))(({ get, derive }) => ({
  doubled: derive(state, "count", (count) => count * 2),
}));
```

### View – Reactive UI Attributes

Views are pure, reactive representations that transform state and actions into
ready-to-spread UI attributes. Views are available for both composition and
consumption. They follow the two-phase pattern for contract selection and
extension.

```ts
const counterView = createView()(({ derive }) => ({
  "data-count": derive(state, "count"),
  "aria-live": "polite",
}));

const enhancedView = createView(baseLattice, ({ view, select }) => ({
  "data-count": select(view.counter, "data-count"),
}))(({ derive, dispatch }) => ({
  "aria-label": "Enhanced counter",
}));
```

> **Summary:**
>
> - **Models and actions**: Available for composition only (not exposed to
>   consumers).
> - **State and views**: Available for both composition and consumption (public
>   API surface).
> - All building blocks use the two-phase (composition/extension) pattern for
>   contract preservation and extensibility.
> - Contract enforcement applies at every boundary—type errors surface on
>   contract violations.

---

## 4. Progressive Examples

### Simple Component Example

A basic counter component implementation using Lattice with the two-phase
(composition/extension) pattern and contract-as-API:

```ts
// Create a counter lattice
const createCounter = () => {
  // Create counter model factory with state and behavior (composition only)
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

  // Define Actions factory (composition only)
  const actions = createActions()(({ mutate }) => ({
    increment: mutate(model, "increment"),
    decrement: mutate(model, "decrement"),
    incrementTwice: mutate(model, "incrementTwice"),
  }));

  // Define public state factory (composition + consumption)
  const state = createState()(({ get, derive }) => ({
    count: derive(model, "getCount"),
    countSquared: derive(model, "count", (count) => count * count),
  }));

  // Create views factory (composition + consumption)
  const counterView = createView()(({ derive }) => ({
    "data-count": derive(state, "count"),
    "aria-live": "polite",
  }));

  const incrementButtonView = createView()(({ derive, dispatch }) => ({
    onClick: dispatch(actions, "increment"),
  }));

  const decrementButtonView = createView()(({ derive, dispatch }) => ({
    onClick: dispatch(actions, "decrement"),
  }));

  // Return composed lattice
  return createLattice(
    "counter",
    {
      // For composition: model, actions
      model,
      actions,
      // Public API: state, view
      state,
      view: mergeViews(counterView, incrementButtonView, decrementButtonView),
    },
  );
};
```

### Medium Complexity Example

A todo list with filtering capabilities using the two-phase pattern and
contract-as-API:

```ts
const createTodoList = () => {
  // Model (composition only)
  const model = createModel()(({ set, get }) => ({
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

  // Actions (composition only)
  const actions = createActions()(({ mutate }) => ({
    addTodo: mutate(model, "addTodo"),
    toggleTodo: mutate(model, "toggleTodo"),
    setFilter: mutate(model, "setFilter"),
    addAndFilterActive: mutate(model, "addAndFilterActive"),
  }));

  // State (composition + consumption)
  const state = createState()(({ get, derive }) => ({
    todos: derive(model, "_getTodos"),
    filter: derive(model, "_getFilter"),
    filteredTodos: derive(model, "getFilteredTodos"),
    filteredTodosCount: derive(model, "getFilteredTodosCount"),
    listLabel: "Todo List",
    isTodoCompleted: derive(model, "isTodoCompleted"),
  }));

  // Views (composition + consumption)
  const todoListView = createView()(({ derive }) => ({
    "aria-label": derive(state, "listLabel"),
    "data-count": derive(state, "filteredTodosCount"),
  }));

  const todoItemView = createView()(({ derive, dispatch }) => ({
    "aria-checked": derive(state, "isTodoCompleted"),
    onClick: dispatch(actions, "toggleTodo"),
  }));

  // Return composed lattice
  return createLattice(
    "todoList",
    {
      // For composition: model, actions
      model,
      actions,
      // Public API: state, view
      state,
      view: mergeViews(todoListView, todoItemView),
    },
  );
};
```

### Complex Component Example – Composition

Creating a complex component through factory composition, with contract
enforcement and public API distinction:

```ts
// Create independent model factories for specific concerns (composition only)
const selectionModelFactory = createModel()(({ set, get }) => ({
  selected: [],
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
}));

const itemsModelFactory = createModel()(({ set, get }) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  getItems: () => get().items,
  getItem: (id) => get().items.find((item) => item.id === id),
}));

// Factory function that returns a lattice composer
export const createFeature = () => {
  return (baseLattice) => {
    // Composite model (composition only)
    const model = createModel()(({ set, get, derive }) => ({
      highlighted: null,
      selected: derive(selectionModelFactory, "selected"),
      items: derive(itemsModelFactory, "items"),
      selectItem: (id, isMulti = false) => {
        selectionModelFactory.selectItem(id, isMulti);
      },
      isSelected: derive(selectionModelFactory, "isSelected"),
      getItems: derive(itemsModelFactory, "getItems"),
      getItemsWithSelection: () => {
        return get().items.map((item) => ({
          ...item,
          selected: get().isSelected(item.id),
        }));
      },
      selectAndHighlight: (id) => {
        get().selectItem(id);
        set({ highlighted: id });
      },
      isHighlighted: (id) => get().highlighted === id,
    }));

    // Actions (composition only)
    const actions = createActions(baseLattice, ({ actions, select }) => ({
      // Select from base lattice actions if needed
    }))(({ mutate }) => ({
      selectItem: mutate(model, "selectItem"),
      selectAndHighlight: mutate(model, "selectAndHighlight"),
    }));

    // State (composition + consumption)
    const state = createState(baseLattice, ({ state, select }) => ({
      // Select from base lattice state if needed
    }))(({ get, derive }) => ({
      itemsWithSelection: derive(model, "getItemsWithSelection"),
      isSelected: derive(model, "isSelected"),
      isHighlighted: derive(model, "isHighlighted"),
    }));

    // Views (composition + consumption)
    const itemView = createView(baseLattice, ({ view, select }) => ({
      role: select(view.item, "role"),
    }))(({ derive, dispatch }) => ({
      "aria-selected": derive(state, "isSelected"),
      "data-highlighted": derive(state, "isHighlighted"),
      onClick: dispatch(actions, "selectAndHighlight"),
    }));

    // Return enhanced lattice
    return createLattice(
      "featureName",
      withLattice(baseLattice)({
        // For composition: model, actions
        model,
        actions,
        // Public API: state, view
        state,
        view: mergeViews(itemView),
      }),
    );
  };
};
```

// All further examples and patterns should follow this distinction: models and
actions are for composition only, state and views are for both composition and
consumption, and contract enforcement applies at every boundary.

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
const model = createModel(baseModel, ({ model, select }) =>
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
const baseModel = createModel()(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  getCount: () => get().count,
}));

// Enhanced model must preserve the contract
const enhancedModel = createModel(baseModel)(({ set, get }) => ({
  // These methods MUST be present with compatible signatures
  // to preserve the base contract
  count: get().count, // Preserved
  increment: get().increment, // Preserved
  getCount: get().getCount, // Preserved

  // New methods can be added safely
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// This would cause a type error - breaking the contract
const invalidModel = createModel(baseModel)(({ set, get }) => ({
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
