# Lattice

A **headless component framework** built on Zustand. React‑first DX with
framework‑agnostic core.

---

## 1 Glossary

| Term        | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| **Slice**   | Private Zustand store created with `create`.                                 |
| **API**     | Unified public interface with getters (selectors) and setters (mutations).   |
| **Props**   | Reactive Zustand store that returns ready-to-spread UI attributes.           |
| **Hooks**   | System to intercept mutations for cross-cutting concerns (`before`/`after`). |
| **Lattice** | Bundle of APIs, props with namespaces. Lattices can compose other lattices.  |

---

## 2 Mental Model & Flow

```
                   ┌────────────── Reactive Zustand Stores ──────────────┐
                   ▼                      ▼                      ▼
Mutation + Hooks ──▶ Slice mutation ──▶ API & Props update ──▶ UI re‑render
```

- One‑way data‑flow. Mutations update slices. API and Props are reactive Zustand
  stores.
- Reactive composition: Private slices → API & Props → UI elements
- Each layer is a Zustand store, enabling precise subscriptions and memoization
- Hooks provide interception points for cross-cutting concerns

---

## 3 Creating a Component Lattice

The basic pattern for creating a lattice:

```ts
// Factory function that returns a lattice composer
export const createFeature = () => {
  // Returns a function that takes a base lattice and returns an enhanced lattice
  return (baseLattice) => {
    // Create private state store
    const featureStore = create(() => ({
      /* initial state */
    }));

    // Create API with hooks system
    const { api, hooks } = createAPI(
      withStoreSync({ featureStore }, ({ featureStore }) => ({
        // Sync properties from private store
      }))((_set, get) => ({
        // Getters and mutations
      })),
    );

    // Create props for UI elements
    const featureProps = createProps(
      "uiPart",
      withProps(baseLattice)((_set, _get) => ({
        get: (params) => ({
          // DOM and ARIA attributes
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
        api,
        hooks,
        props: mergeProps(featureProps),
      }),
    );
  };
};
```

---

## 4 Instance Usage

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
    treeA.api,
    (state) => state.isSelected(id),
  );

  // Access mutation methods
  const selectNode = useStore(
    treeA.api,
    (state) => state.selectNode,
  );

  // Get ready-to-spread props
  const props = useStore(
    treeA.props.treeItem,
    (propsStore) => propsStore.get({ id }),
  );

  return <div {...props}>{/* content */}</div>;
}

// Add instance-specific hooks
treeA.hooks.after("selectNode", (id) => {
  console.log(`Selected node ${id} in treeA`);
});

// Direct API access pattern
treeA.api.selectNode("node-1"); // No need for .getState()
```

Each instance maintains isolated state with proper store synchronization.

---

## 5 Props System

The Props system in Lattice bridges state management and UI rendering:

```
┌────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│                │     │                   │     │                    │
│ Private Slices │────▶│  API (getters &   │────▶│  Props (reactive   │
│ (state stores) │     │    mutations)     │     │   UI attributes)   │
│                │     │                   │     │                    │
└────────────────┘     └───────────────────┘     └─────────┬──────────┘   
                                                           │              
                                                           │              
                                                           ▼              
                                              ┌──────────────────────────┐
                                              │                          │
                                              │ React/Vue/etc Components │
                                              │  (spread props on els)   │
                                              │                          │
                                              └──────────────────────────┘
```

### Core Concepts

1. **Reactive Store**: Props are Zustand stores returning ready-to-spread UI
   attributes
2. **UI Part Namespacing**: Props are organized by UI part (e.g., `tree`,
   `treeItem`)
3. **Metadata-Driven**: Props stores carry their UI part name as metadata
4. **Composition Model**: Props can be extended, overridden, or merged per
   namespace

### Creating and Using Props

```tsx
// Basic props creation with direct config
const buttonProps = createProps(
  "button", // UI part name
  (_set, _get) => ({
    get: (params) => ({
      role: "button",
      "aria-label": params.label,
      tabIndex: 0,
      // Other attributes based on state
    }),
  }),
);

// Using withProps to compose with base lattice
const treeItemProps = createProps(
  "treeItem",
  withProps(baseLattice)((_set, _get, baseProps) => ({
    get: (params) => ({
      // Extend or override base props
      "aria-selected": selectionAPI.isSelected(params.id),
      onClick: (e) => {
        // Can call base handler if needed
        baseProps.get(params).onClick?.(e);
        // Add additional behavior
      },
    }),
  })),
);

// In a component:
function Button({ lattice, id }) {
  const props = useStore(
    lattice.props.button,
    (propsStore) => propsStore.get({ id }),
  );

  return <button {...props}>Click Me</button>;
}
```

### Advantages

1. **Reactive**: Props update automatically when state changes
2. **Granular Re-renders**: Components only re-render when needed props change
3. **Composition Without Conflicts**: Props from multiple lattices compose
   cleanly
4. **Framework Agnostic**: Works with any UI framework supporting attribute
   spreading
5. **Type-Safe**: Full TypeScript support for props parameters and returns

---

## 6 Direct API Access

Lattice provides direct access to API methods without requiring `.getState()`:

```ts
// ✅ Direct API access (preferred)
selectionAPI.selectNode(id, multi);
selectionAPI.isSelected(id);

// ❌ Verbose chaining (avoid)
selectionAPI.getState().selectNode(id, multi);
selectionAPI.getState().isSelected(id);
```

This pattern:

- Reduces verbosity
- Creates cleaner, more readable code
- Provides a consistent mental model
- Improves developer experience

---

## 7 Hooks System

The hooks system enables interception and modification of API method calls:

```ts
// Register hooks for an API method
lattice.hooks.before("selectNode", (id, multi) => {
  // Run before selectNode is called
  // Can return modified arguments
  console.log(`About to select ${id}`);
  return id; // Can modify arguments
});

lattice.hooks.after("selectNode", (result, id, multi) => {
  // Run after selectNode completes
  // Can modify return value
  console.log(`Selected ${id}`);
  return result; // Can modify return value
});
```

Hooks provide:

- Cross-cutting concerns without modifying implementation
- Communication between lattice features
- Custom logic on a per-instance basis
- Proper execution order with deterministic behavior

---

## 8 Why Lattice, not "just hooks"

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through layered Zustand stores; props merge safely. |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework-agnostic; adapters are thin wrappers.                       |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Props are reactive Zustand stores, merged per UI part                                              |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Features can be added/removed at instantiation, with granular reactivity throughout stores.        |

### Unique Value Propositions

- **Unified API**: Getters and mutations in a single API object with
  auto-generated hooks
- **Hooks System**: Clean interception points for cross-cutting concerns
- **Layered Zustand Stores**: Slices → API → Props, with precise reactivity
- **Lattice Composition**: Behaviors cooperate via hooks—no fragile ref hacks
- **Zustand Foundation**: Familiar DX, dev‑tools time‑travel, no custom state
  engine
- **Instance-based Architecture**: Multiple independent instances with proper
  state isolation

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> composability, portability, and proper state isolation**, Lattice provides the
> missing middle layer.
