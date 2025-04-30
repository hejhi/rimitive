# Lattice – Draft Spec v0.5 (2025‑05‑02)

A **headless, WCAG‑AA‑ready component framework** built on Zustand. The goal is
React‑first DX with framework‑agnostic core.

---

## 1 Glossary (revised)

| Term        | Meaning                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Slice**   | Private Zustand store created with `createStore`.                                            |
| **API**     | Public functions (both selectors and commands) exposed from a lattice.                       |
| **Props**   | Reactive Zustand store that returns ready-to-spread UI attributes including ARIA properties. |
| **Hook**    | `onBefore`/`onAfter` callback to intercept commands for cross-cutting concerns.              |
| **Lattice** | Bundle of APIs, props with namespaces. Lattices can compose other lattices.                  |

---

## 2 Mental Model & Flow

```
                   ┌────────────── Reactive Zustand Stores ──────────────┐
                   ▼                      ▼                      ▼
Command + Hooks ──▶ Slice mutation ──▶ API & Props update ──▶ UI re‑render
```

- One‑way data‑flow. Commands update slices. APIs and Props are reactive Zustand
  stores.
- Reactive composition: Private slices → API & Props → UI elements
- Each layer is a Zustand store, enabling precise subscriptions and memoization
- Hooks provide interception points for cross-cutting concerns
  (onBefore/onAfter)

---

## 3 Factory Helpers (Zustand‑style)

```ts
// 1️⃣  Slices (private)
const treeStore = createStore((set, get) => ({
  nodes: {} as Record<ID, Node>,
  open: new Set<ID>(),

  // Internal state mutation
  _toggleNode: (id: ID) => {
    set((state) => {
      const nextOpen = new Set(state.open);
      state.open.has(id) ? nextOpen.delete(id) : nextOpen.add(id);
      return { ...state, open: nextOpen };
    });
  },
}));

// 2️⃣  API (combined selectors and commands)
export const treeAPI = createAPI(
  { treeStore }, // dependencies
  ({ treeStore }) => ({
    // Selectors (read functions)
    isOpen: (id) => treeStore.getState().open.has(id),
    children: (id) =>
      Object.values(treeStore.getState().nodes).filter((n) => n.parent === id),

    // Commands (write functions with hooks)
    toggleNode: createCommand(
      (id: ID) => {
        treeStore.getState()._toggleNode(id);
      },
    ),
  }),
);

// 3️⃣  Props (reactive Zustand stores with UI attributes)
const treeProps = createProps(
  "tree",
  {}, // No additional dependencies
  () => ({
    // Returns a Zustand store with DOM/ARIA properties
    role: "tree",
    tabIndex: 0,
  }),
);

const treeItemProps = createProps(
  "treeItem",
  { treeAPI }, // Depends on API
  (get, { id }) => ({
    // Returns a Zustand store with DOM/ARIA properties
    role: "treeitem",
    "aria-expanded": get(treeAPI).isOpen(id), // Subscribes to API
  }),
);

// 4️⃣  Package as lattice
export const arboreal = createLattice(
  "arboreal", // namespace key
  {}, // dependencies
  () => ({
    api: treeAPI,
    props: { tree: treeProps, treeItem: treeItemProps },
  }),
);

// Helper to create a unified API
function createAPI(dependencies, factory) {
  const api = factory(dependencies);

  // Create a reactive Zustand store
  const apiStore = create(() => api);

  // Auto-generate hook-friendly selectors for React
  apiStore.use = {};
  for (const key of Object.keys(api)) {
    if (typeof api[key] === "function") {
      // For commands, just return the function
      apiStore.use[key] = () => api[key];
    } else {
      // For other values, create a selector
      apiStore.use[key] = (params) =>
        useStore(
          apiStore,
          (state) =>
            typeof state[key] === "function" ? state[key](params) : state[key],
        );
    }
  }

  return apiStore;
}

// Helper to create a command with hook support
function createCommand(fn) {
  // Create empty arrays for before/after hooks
  const beforeHooks = [];
  const afterHooks = [];

  // The command function that runs hooks
  const command = (...args) => {
    // Run before hooks
    for (const hook of beforeHooks) {
      const result = hook(...args);
      if (result === false) return; // Cancel if a hook returns false
    }

    // Run the command
    const result = fn(...args);

    // Run after hooks
    for (const hook of afterHooks) {
      hook(result, ...args);
    }

    return result;
  };

  // Add hook methods
  command.onBefore = (hook) => {
    beforeHooks.push(hook);
    return command;
  };

  command.onAfter = (hook) => {
    afterHooks.push(hook);
    return command;
  };

  return command;
}
```

### Composing a **Selection** lattice

```ts
import { arboreal, treeAPI } from "@lattice/arboreal";

// Slice (private store)
const selectStore = createStore((set) => ({
  selected: new Set<ID>(),

  // Internal state mutation
  _selectNode: (id: ID, multi: boolean) => {
    set((state) => {
      const nextSelected = multi ? new Set(state.selected) : new Set();
      nextSelected.add(id);
      return { ...state, selected: nextSelected };
    });
  },
}));

// API (combined selectors and commands)
export const selectionAPI = createAPI(
  { selectStore },
  ({ selectStore }) => ({
    // Selectors
    isSelected: (id) => selectStore.getState().selected.has(id),

    // Commands
    selectNode: createCommand(
      (id: ID, multi = false) => {
        selectStore.getState()._selectNode(id, multi);
      },
    ),
  }),
);

// Props
const selectionTreeItemProps = createProps(
  "treeItem",
  { selectionAPI },
  (get, { id }) => ({
    // Reactively subscribes to the selection state
    "aria-selected": get(selectionAPI).isSelected(id),
  }),
);

export const arborealSelection = createLattice(
  "selection", // namespace key
  { arboreal }, // dependencies
  ({ arboreal }) => ({
    api: selectionAPI,
    props: {
      // Extend the treeItem props with selection props
      treeItem: selectionTreeItemProps,
    },
    // Initialize cross-cutting concerns
    init: () => {
      // When toggling a node, also select it
      treeAPI.getState().toggleNode.onBefore((id) => {
        selectStore.getState()._selectNode(id, false);
      });
    },
  }),
);
```

## 5 Drag and Drop Plugin Example

```ts
export const arborealDragAndDrop = createLattice(
  "dragAndDrop", // namespace key
  { arboreal, arborealSelection }, // dependencies
  ({ arboreal, arborealSelection }) => ({
    api: createAPI(
      {}, // dependencies
      () => ({
        // Selectors
        isDragging: (id) => {/* ... */},
        canDrop: (id) => {/* ... */},

        // Commands
        dragStart: createCommand((id) => {/* ... */}),
        drop: createCommand((targetId) => {/* ... */}),
      }),
    ),
    props: {
      // Each lattice contributes props to UI parts that are automatically merged
      treeItem: createProps(
        "treeItem",
        { selectionAPI: arborealSelection.api }, // Explicit dependency
        (get, { id }) => ({
          draggable: true,
          // Using get() pattern to subscribe to state changes from other stores
          "aria-grabbed": get(/* dragAPI */).isDragging(id),
          // Only allow dragging selected items - subscribes to selection state
          "data-draggable": get(arborealSelection.api).isSelected(id),
          onDragStart: () => {/* ... */},
          onDrop: () => {/* ... */},
        }),
      ),
    },
    // Initialize cross-cutting concerns
    init: () => {
      // After a drop completes, refresh the tree
      const dropCommand = get(/* dragAPI */).drop;
      dropCommand.onAfter((result, targetId) => {
        // Additional logic after drop
      });
    },
  }),
);
```

## 6 Consuming in an app

```ts
// Compose lattices (system automatically resolves dependencies)
const tree = arboreal.use(arborealSelection, arborealDragAndDrop);

// Access API via flat structure
const isOpen = tree.api.use.isOpen(id);
const isSelected = tree.api.use.isSelected(id);
const isDragging = tree.api.use.isDragging(id);

// Call commands
const toggleNode = tree.api.getState().toggleNode;
const selectNode = tree.api.getState().selectNode;
const dragStart = tree.api.getState().dragStart;

// Command execution
toggleNode(id);
selectNode(id, false);
dragStart(id);

// Access via namespaced API (useful for conflicts)
tree.arboreal.api.getState().toggleNode(id);
tree.selection.api.getState().selectNode(id);
tree.dragAndDrop.api.getState().dragStart(id);

// Props always merge contributions from all lattices
const itemProps = tree.props.treeItem({ id });
// Result contains props from arboreal, selection, and dragAndDrop
```

The system automatically handles dependency resolution based on the dependencies
declared in each lattice's factory. Under the hood, command interception works
through a hooks system (onBefore/onAfter) that provides clean integration points
without fragile dependencies between lattices.

## 7 React Usage Example

```tsx
function TreeNode({ id }: { id: ID }) {
  // Use Zustand's useStore pattern to subscribe to the props store
  // Only re-renders when relevant props for this ID change
  const props = useStore(tree.props.treeItem, (props) => props({ id }));

  // Subscribe to specific API values for conditional rendering
  const isOpen = tree.api.use.isOpen(id);
  const isSelected = tree.api.use.isSelected(id);

  // Get command functions (these don't cause re-renders)
  const toggleNode = tree.api.use.toggleNode();
  const selectNode = tree.api.use.selectNode();

  return (
    <li
      {...props}
      // Spread all reactive ARIA, data-attributes, and event handlers
      className={`
        ${isOpen ? "open" : "closed"} 
        ${isSelected ? "selected" : ""}
      `}
      onClick={() => {
        // Execute commands from different lattices
        toggleNode(id);
        selectNode(id, false);
      }}
    >
      {isOpen ? "📂" : "📁"} Node {id}
      {/* Children rendered here */}
    </li>
  );
}
```

## 8 Accessibility Strategy

1. **Props carry semantics** → host adapters just spread them on elements.
2. **Shared keyboard map** plugin enforces WCAG navigation patterns.
3. **Playwright + axe** contract tests run for each lattice combo.

---

## 9 Rationale — Why Lattice, not "just hooks"

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through layered Zustand stores; props merge safely.    |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework-agnostic; adapters are thin wrappers.                          |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Props are reactive Zustand stores, merged per UI part; shared keyboard plugin enforces WCAG patterns. |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Feature lattices can be added/removed at instantiation, with granular reactivity throughout stores.   |

### Unique value propositions

- **Unified API**: Selectors and commands in a single API object with
  auto-generated hooks.
- **Command hooks system**: Clean interception points for cross-cutting concerns
  without boilerplate.
- **Layered Zustand stores**: Slices → API → Props, with precise, granular
  reactivity.
- **Plugin composition**: Behaviours cooperate via hooks—no fragile ref hacks.
- **Zustand foundation**: familiar DX, dev‑tools time‑travel, no custom state
  engine.

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> pluginability, and portability**, Lattice provides the missing middle layer.

---

## 10 Open Questions

- Hot‑reload boundary: HMR should reuse slices—explore `zustand/middleware`.
- How to best handle composition of commands across lattices?
- API organization: should we separate read/write operations at the API level?
- Exploration of TypeScript's inference capability for composed lattices.
